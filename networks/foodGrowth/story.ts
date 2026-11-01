// ═══════════════════════════════════════════════════════
// MetroMatrix — Kitchen Story Network (docs/API_KITCHEN.md §23)
// ═══════════════════════════════════════════════════════
// The story and the hygiene checklist are one record: a save sends both
// (anything left out is cleared). A complete checklist is self-declared at
// once; staff verify it after a visit or a video call.

import { API, toApiError, clean } from '../network/network';
import type { HygieneChecklist, KitchenStory } from '../../models/kitchen';

/** The story, the checklist, the hygiene status and badge. */
export const fetchStory = async (): Promise<unknown> => {
  try {
    const response = await API.GET({ URL: '/food/vendor/story' });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};

export const saveStory = async (story: Pick<KitchenStory, 'text' | 'cookName' | 'photoUrls' | 'videoUrl'>, checklist: HygieneChecklist): Promise<unknown> => {
  try {
    const data = {
      ...clean({ story: story.text.trim(), cookName: story.cookName.trim(), videoUrl: story.videoUrl }),
      photos: story.photoUrls,
      hygieneChecklist: { ...checklist, pestControlOn: checklist.pestControlOn ?? null },
    };
    const response = await API.PUT({ URL: '/food/vendor/story', data });
    return response.data;
  } catch (e) {
    throw toApiError(e);
  }
};
