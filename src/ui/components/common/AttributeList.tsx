/**
 * AttributeList component
 * Reusable component for managing attributes for any entity type (characters, worlds, adventures)
 */

import {Plus, Trash2, X} from 'lucide-react';
import {useState} from 'react';
import {Trans, useTranslation} from 'react-i18next';
import {ConfirmDialog} from '../ConfirmDialog';
import {Button, Icon, IconButton, Input, Textarea} from '@/ui/primitives';

export type AttributeType = 'stat' | 'skill' | 'trait' | 'equipment' | 'detail' | 'custom';

export interface AttributeCategory {
  id: string;
  name: string;
  type: AttributeType;
  description: string;
}

export interface Attribute {
  key: string;
  value: string;
}

interface AttributeListProps {
  category: AttributeCategory;
  attributes: Attribute[];
  onAddAttribute: () => void;
  onUpdateAttribute: (index: number, field: 'key' | 'value', value: string) => void;
  onRemoveAttribute: (index: number) => void;
  onDeleteCategory?: (categoryId: string) => void;
  isDeletable?: boolean;
  valueIsTextarea?: boolean;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addButtonLabel?: string;
}

export const AttributeList = ({
  category,
  attributes,
  onAddAttribute,
  onUpdateAttribute,
  onRemoveAttribute,
  onDeleteCategory,
  isDeletable = false,
  valueIsTextarea = false,
  keyPlaceholder,
  valuePlaceholder,
  addButtonLabel
}: AttributeListProps) => {
  const {t} = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const singularName = category.name.slice(0, -1);

  // Handle delete category button click
  const handleDeleteClick = () => {
    // If there are attributes, show confirmation dialog
    if (attributes.length > 0) {
      setShowDeleteConfirm(true);
    } else {
      // If empty, delete immediately
      onDeleteCategory?.(category.id);
    }
  };

  // Generate placeholders based on category name or use provided ones
  const defaultKeyPlaceholder = t('ui.attributeList.namePlaceholder', {name: singularName});
  const defaultValuePlaceholder = t('ui.attributeList.valuePlaceholder');
  const defaultAddButtonLabel = t('ui.attributeList.add', {name: singularName});

  return (
    <div className="mb-4 rounded-lg border border-parchment-50/10 bg-ink-700 p-4">
      <div className="mb-4 flex flex-col items-start justify-between gap-2 md:flex-row md:items-start">
        <div className="flex-1">
          <h3 className="m-0 mb-2 font-display text-lg font-semibold text-parchment-50">{category.name}</h3>
          {category.description && (
            <p className="m-0 font-narrative text-sm leading-snug text-parchment-400">{category.description}</p>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-2 md:w-auto md:justify-end">
          <Button
            type="button"
            kind="secondary"
            size="sm"
            iconLeft={<Icon icon={Plus} size={14} />}
            onClick={onAddAttribute}
            title={t('ui.attributeList.addNew', {name: singularName})}
          >
            {addButtonLabel || defaultAddButtonLabel}
          </Button>
          {isDeletable && onDeleteCategory && (
            <Button
              type="button"
              kind="danger"
              size="sm"
              iconLeft={<Icon icon={Trash2} size={14} />}
              onClick={handleDeleteClick}
              title={t('ui.attributeList.deleteCategoryTitle', {name: category.name})}
            >
              {t('ui.attributeList.delete')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {attributes.length === 0 && (
          <div className="rounded-sm bg-ink-600 p-4 text-center font-narrative italic text-parchment-400">
            <p className="m-0">{t('ui.attributeList.emptyHint', {name: category.name.toLowerCase()})}</p>
          </div>
        )}

        {attributes.map((attr, index) => (
          <div
            key={index}
            className="flex flex-col items-start gap-2 rounded-sm border-b border-parchment-50/10 p-2 pb-2 transition-colors hover:bg-ink-600 md:flex-row md:border-b-0"
          >
            <Input
              className="w-full flex-1 md:w-auto"
              type="text"
              placeholder={keyPlaceholder || defaultKeyPlaceholder}
              value={attr.key}
              onChange={(e) => onUpdateAttribute(index, 'key', e.target.value)}
            />
            {valueIsTextarea ? (
              <Textarea
                className="w-full flex-[2] min-h-[60px] md:w-auto"
                placeholder={valuePlaceholder || defaultValuePlaceholder}
                value={attr.value}
                onChange={(e) => onUpdateAttribute(index, 'value', e.target.value)}
                rows={2}
              />
            ) : (
              <Input
                className="w-full flex-[2] md:w-auto"
                type="text"
                placeholder={valuePlaceholder || defaultValuePlaceholder}
                value={attr.value}
                onChange={(e) => onUpdateAttribute(index, 'value', e.target.value)}
              />
            )}
            <IconButton
              tone="danger"
              size="sm"
              onClick={() => onRemoveAttribute(index)}
              label={t('ui.attributeList.remove')}
            >
              <Icon icon={X} size={14} />
            </IconButton>
          </div>
        ))}
      </div>

      {/* Confirmation dialog */}
      <ConfirmDialog
        visible={showDeleteConfirm}
        title={t('ui.attributeList.deleteTitle', {name: category.name})}
        message={
          <>
            <p>
              <Trans
                i18nKey="ui.attributeList.deleteQuestion"
                values={{name: category.name}}
                components={[<strong key="name" />]}
              />
            </p>
            <p>{t('ui.attributeList.deleteWarning', {count: attributes.length})}</p>
          </>
        }
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDeleteCategory?.(category.id);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmLabel={t('ui.attributeList.confirmDelete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
      />
    </div>
  );
};
