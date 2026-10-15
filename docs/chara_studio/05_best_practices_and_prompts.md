# Character image practices and prompt examples

**Research updated:** 2026-10-15. **Status:** Practical guidance for WIP editing/reference flows. Examples are original and untested in this app. Product sources were rechecked; [current implementation](01_current_project.md) separates research from available features.

These are practical suggestions for using the existing GPT image models. The example prompts are original and were not run during this research.

## Help the user describe an edit

The UI can teach a short pattern: **source + change + preserve**. For example: select the travel image, request a navy formal coat, retain the face and markings. An optional helper can turn a task suggestion into editable text; the user should not need to learn provider prompt syntax.

| Task | Useful direction | What to inspect |
|---|---|---|
| Outfit | Name the clothing/accessory change and retained anatomy | Face, proportions, marking positions, equipment |
| Expression | Describe emotion and its intensity | Facial structure, eyes, teeth and unwanted pose changes |
| Pose/view | Describe body position and camera view | Silhouette, limbs, tail/wings and invented hidden details |
| Background | Describe setting/lighting and whether composition should stay | Unwanted changes to subject, framing or costume |
| New scene | Identify character inputs and current action | Identity, outfit, props and story event |
| Cutout | Request isolated subject with transparent background | Real alpha, edge halos and missing small features |

These are creative instructions, not guaranteed model locks. Task chips should help compose them and remain editable before generation. [Leonardo's inline editing guidance](https://intercom.help/leonardo-ai/en/articles/11483692-using-omni-models-and-the-inline-editor) provides a comparable instruction-based interaction.

## Start with a clear visual description

Separate what is visible from narrative information. A character's job or personality can inspire the image, but it does not specify its face, anatomy, proportions or clothes.

Useful appearance details include species, age presentation, face shape, hair/fur, eyes, body proportions, distinctive markings and clothing. Record which details belong to the character and which belong only to an outfit or scene.

For a creature, describe the actual anatomy and silhouette. A recognizable dragon, robot or fox-person is more than a human face.

## Keep a recognizable base image

Once a useful design exists, use its pixels for subsequent edits and scenes. A fixed name or repeated description is insufficient to communicate every visual detail.

A clean portrait helps with identity; a full-body image helps with silhouette, proportions and clothing. Use a clear subject, readable lighting and a background that does not hide important features.

NovelAI's character-reference documentation discusses clean, neutral full-body views and useful face detail. This is a helpful reference-preparation example, not a reason to introduce its models into this feature. [Precise Reference](https://docs.novelai.net/en/image/precisereference/).

## Edit what needs changing

Say both what changes and what stays. A small, specific edit is easier to assess than changing the face, clothing, pose and style simultaneously.

Use the current image when refining it. When a long chain starts drifting, return to a useful original/reference rather than treating the newest output as automatically more accurate.

Keep earlier useful results so the user can select one or continue editing an older image whenever needed.

## Choose references by purpose

| Purpose | What matters |
|---|---|
| Identity | Face, silhouette, species anatomy and signature details |
| Outfit | Clothing, accessories, equipment and their placement |
| Expression | Emotion while retaining recognizable facial structure |
| Pose | Action and body position |
| Style | Medium, linework, shading and palette |

These are ways to describe inputs clearly, not separate systems the application has to build. Several contradictory images can make the model combine incompatible traits.

For one character, a face reference and an outfit view can be complementary. For two characters, each reference needs a subject name. For style transfer, say which image supplies the style and which supplies identity. Keep those meanings consistent between thumbnails and the actual request.

If an old reference shows the wrong outfit, remove it or explain that it supplies identity only. Sending more images is not automatically stronger guidance. When only one view exists, distinguish a requested new design detail from a detail the image actually establishes.

## Prompt examples

### First full-body image

> A full-body illustration of an adult fox-person traveler with copper fur, cream cheek markings, amber eyes, upright ears and a cream-tipped tail. Compact athletic build. A small crescent marking sits beneath the character's left eye. Moss-green travel coat, leather shoulder strap and dark boots. Relaxed standing pose, clear silhouette, plain neutral background, clean fantasy illustration.

### Change the outfit

> Use image 1 as the character reference. Replace the green travel coat with a tailored navy formal coat. Keep the same face, eyes, ears, markings, tail and body proportions. Retain the pose, framing and illustration style.

### Change an expression

> Change this character's neutral expression to a subtle amused smile. Keep the same face proportions, eye color, markings, clothing, head angle and framing.

### Make another view

> Show the same character and outfit in a three-quarter rear view. Keep the ears, tail proportions, coat, strap and boots consistent with the references. Show the full figure against a plain background.

If the references do not show the back of a costume, the output invents that detail. Keep it only if it fits the intended design.

### Place the character in a scene

> Using the supplied character images, depict this traveler standing under a stone arch in the rain, holding a closed map. Keep the same face, markings, silhouette and travel outfit. Wide composition, wet stone and soft evening light.

## Inspect the features that matter

Check identity, anatomy, markings, outfit, requested change and usability. For several characters, also check whose clothing and props ended up on each subject.

An attractive image can still depict the wrong design. A higher resolution cannot fix an incorrect tail pattern or a swapped outfit by itself.

For expressions, consistent framing makes the assets easier to reuse. For character sheets, inspect each view; a convincing sheet can contain inconsistent designs. Assemble a useful overview from existing images when layout is all that is needed.

For cutouts, inspect alpha edges, hair, ears, wings and small accessories. For a card thumbnail, crop the useful image rather than regenerating the character simply to change framing.

## Keep controls honest

Use the GPT settings actually exposed by the project. Do not add a seed, a negative prompt or a fictional identity-strength slider just because another generator has one.

Show relevant inputs and a before/after comparison. Let the user decide whether the result is useful. OpenAI documents remaining limitations in consistency and composition, so avoid promising an exact character lock. [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation).
