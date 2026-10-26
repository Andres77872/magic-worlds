"""Expected-behavior probes on disposable MySQL: xfail means confirmed defect."""
import json
import os
from pathlib import Path

import httpx
import pytest

from src.database.mysql.models import MembershipModel
from src.database.mysql.membership_admin_models import MembershipPlanAdminModel
from src.routes import admin_billing
from src.services.scope import AppScope
from tests.integration.test_membership_custom_plan_database import _app, _plan, _create_and_assign, ROOT_HEADERS
from tests.integration.test_llm_profile_database import _repository_fixture, _run

D=Path(os.environ.get('MEMBERSHIP_AUDIT_EVIDENCE_DIR', '/tmp/plans-e2e-audit-20261017'))
D.mkdir(parents=True,exist_ok=True)
SCOPE=AppScope(project_hash='project-fixture',user_group_hash='group-fixture')


def record(name,data):
    (D/(name+'.json')).write_text(json.dumps(data,indent=2,default=str))
    print(name,json.dumps(data,default=str),flush=True)


@pytest.mark.xfail(strict=True,reason='A pre-reset refund erases post-reset usage')
def test_refund_before_daily_reset_preserves_new_usage(monkeypatch):
    async def case(pool):
        profiles,(root,alice,_),_=await _repository_fixture(pool)
        app=_app(monkeypatch,pool)
        app.include_router(admin_billing.router)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as c:
            await _create_and_assign(c,alice.user_id,_plan(credits=30,daily=10,cost=5))
            async with profiles.transaction() as (_,cur):
                old=await MembershipModel.reserve_media_operation(user_id=alice.user_id,operation='theme_song_generation',cursor=cur)
                assert old['outcome']=='accepted'
            reset=await c.post('/admin/billing/quota-resets',headers=ROOT_HEADERS,json={'target':'user','user_id':alice.user_id,'periods':['daily'],'reason':'Isolated E2E audit'})
            assert reset.status_code==200,reset.text
            plan=(await c.get('/admin/billing/plans/tester',headers=ROOT_HEADERS)).json()
            plan['limits']['theme_song_generation']['credit_cost']=2
            assert (await c.patch('/admin/billing/plans/tester',headers=ROOT_HEADERS,json={'limits':plan['limits']})).status_code==200
            async with profiles.transaction() as (_,cur):
                new=await MembershipModel.reserve_media_operation(user_id=alice.user_id,operation='theme_song_generation',cursor=cur)
                assert new['outcome']=='accepted'
            before=(await c.get('/user/me')).json()['membership']
            async with profiles.transaction() as (_,cur):
                await MembershipModel.refund_credit_ledger(user_id=alice.user_id,operation='theme_song_generation',ledger_ids=old['ledger_ids'],cursor=cur)
            after=(await c.get('/user/me')).json()['membership']
            record('defect-reset-refund',{'credits_before_refund':before['credits'],'credits_after_refund':after['credits'],'operation_after':after['limits']['theme_song_generation'],'monthly_credits':after['monthly_usage']['credits_used'],'expected_daily_credits':2,'expected_daily_requests':1})
            assert after['credits']['used']==2
            assert after['limits']['theme_song_generation']['used_today']==1
    _run(case)


@pytest.mark.xfail(strict=True,reason='Consumer monthly reset is ignored by root monthly totals')
def test_monthly_reset_has_consistent_root_and_consumer_totals(monkeypatch):
    async def case(pool):
        profiles,(_,alice,_),_=await _repository_fixture(pool)
        app=_app(monkeypatch,pool)
        app.include_router(admin_billing.router)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as c:
            await _create_and_assign(c,alice.user_id,_plan(credits=20,daily=10,cost=5))
            async with profiles.transaction() as (_,cur):
                old=await MembershipModel.reserve_media_operation(user_id=alice.user_id,operation='theme_song_generation',cursor=cur)
                assert old['outcome']=='accepted'
                await cur.execute('UPDATE membership_credit_ledger SET created_at=DATE_SUB(NOW(),INTERVAL 1 HOUR) WHERE user_id=%s',(alice.user_id,))
            r=await c.post('/admin/billing/quota-resets',headers=ROOT_HEADERS,json={'target':'user','user_id':alice.user_id,'periods':['monthly'],'reason':'Isolated E2E audit'})
            assert r.status_code==200,r.text
            consumer=(await c.get('/user/me')).json()['membership']['monthly_usage']
            members=(await c.get('/admin/billing/memberships?search=alice',headers=ROOT_HEADERS)).json()['items']
            overview=(await c.get('/admin/billing/membership-overview',headers=ROOT_HEADERS)).json()
            record('defect-monthly-reset',{'consumer_credits':consumer['credits_used'],'root_member_credits':members[0]['credits_used_month'],'root_overview_credits':overview['totals']['credits_used_month']})
            assert consumer['credits_used']==members[0]['credits_used_month']==overview['totals']['credits_used_month']
    _run(case)


@pytest.mark.xfail(strict=True,reason='An action split across PAYG buckets is counted twice')
def test_split_payg_payment_counts_one_operation(monkeypatch):
    async def case(pool):
        profiles,(_,alice,_),_=await _repository_fixture(pool)
        app=_app(monkeypatch,pool)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as c:
            await _create_and_assign(c,alice.user_id,_plan(credits=0,daily=10,cost=5))
            async with profiles.transaction() as (_,cur):
                await MembershipModel._ensure_payg_wallet(cur,user_id=alice.user_id)
                await MembershipModel._update_payg_wallet(cur,user_id=alice.user_id,free_balance=2,billed_balance=3)
                result=await MembershipModel.reserve_media_operation(user_id=alice.user_id,operation='theme_song_generation',cursor=cur)
                assert result['outcome']=='accepted'
            summary=(await c.get('/user/me')).json()['membership']
            overview=(await c.get('/admin/billing/membership-overview',headers=ROOT_HEADERS)).json()
            month=summary['monthly_usage']['operations']['theme_song_generation']
            operation=next(row for row in overview['operations_month'] if row['operation']=='theme_song_generation')
            record('defect-split-payg-count',{'daily_requests':summary['limits']['theme_song_generation']['used_today'],'consumer_monthly_requests':month['used'],'root_monthly_requests':operation['used'],'credits_charged':month['credits_used'],'wallet':summary['payg'],'expected_requests':1})
            assert summary['limits']['theme_song_generation']['used_today']==month['used']==operation['used']==1
    _run(case)
