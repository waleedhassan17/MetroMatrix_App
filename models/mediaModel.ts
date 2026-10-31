// ═══════════════════════════════════════════════════════
// MetroMatrix — Media model
// ═══════════════════════════════════════════════════════
// What the app uploads, and the API's name for each (POST /media/sign-upload's
// `purpose`, the backend's UPLOAD_PURPOSES): FinMatrix keeps its to-API maps
// in models.

export type UploadPurpose =
  | 'avatar'
  | 'business_document'
  // Shopping
  | 'product_image'
  | 'store_logo'
  | 'store_cover'
  | 'review_photo'
  | 'return_photo'
  | 'payment_proof'
  | 'banner_image'
  // Healthcare
  | 'health_record'
  | 'doctor_photo'
  | 'consult_attachment'
  // Food (docs/API_FOOD.md §1: food_branding for a brand's logo and cover, menu_item for dish photos)
  | 'food_logo'
  | 'food_cover'
  | 'menu_item'
  // Kitchen Intelligence (TODO(API_KITCHEN): the API has no purpose of its own
  // for a surplus box or hygiene photo; both go where its stories do)
  | 'voice_clip'
  | 'kitchen_receipt'
  | 'food_packing'
  | 'food_surplus'
  | 'food_story'
  | 'hygiene_evidence';

/** The app's purposes → the API's (one store branding folder; doctors' note files are `medical_note`). */
export const API_PURPOSE: Record<UploadPurpose, string> = {
  avatar: 'avatar',
  business_document: 'business_document',
  product_image: 'product_image',
  store_logo: 'store_branding',
  store_cover: 'store_branding',
  review_photo: 'review_photo',
  return_photo: 'return_photo',
  payment_proof: 'payment_proof',
  banner_image: 'banner',
  health_record: 'health_record',
  doctor_photo: 'doctor_photo',
  consult_attachment: 'medical_note',
  food_logo: 'food_branding',
  food_cover: 'food_branding',
  menu_item: 'menu_item',
  voice_clip: 'voice_audio',
  kitchen_receipt: 'receipt',
  food_packing: 'packing_proof',
  food_surplus: 'kitchen_story',
  food_story: 'kitchen_story',
  hygiene_evidence: 'kitchen_story',
};
