/* Generated from pharmacy_product_registry.schema.json. Do not edit. */

export type Sha256 = string;
export type NullableText = string | null;
export type TextArray = string[];
export type ContentBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "table";
      headers: string[];
      rows: string[][];
    };

export interface PharmacyProductRegistry {
  schemaVersion: "1.0.0";
  generatedAt: string;
  source: {
    logicalName: "pharmacy-product-catalog-portable-v1";
    contentSha256: Sha256;
    byteLength: number;
    recordCount: number;
  };
  pack: {
    packId: string;
    version: string;
    mappingContentSha256: Sha256;
    ingredientCount: number;
    protocolOptionCount: number;
  };
  records: RegistryRecord[];
}
export interface RegistryRecord {
  registryRecordId: string;
  retailOffer: RetailOffer;
  officialMatch: OfficialMatch;
  officialProduct: null | OfficialProduct;
  recommendation: Recommendation;
}
export interface RetailOffer {
  skuId: string;
  documentId: string;
  displayName: string;
  normalizedName: string;
  capacity: string;
  normalizedCapacity: string;
  specification: string;
  category: string;
  displayedPriceKrw: number;
  currency: "KRW";
  recordedAt: string;
  priceStatus: string;
  sourceType: string;
  verificationStatus: string;
  image: {
    url: NullableText;
    sourceUrl: NullableText;
    rightsStatus: NullableText;
    kind: NullableText;
    checkedAt: null | string;
  };
}
export interface OfficialMatch {
  status: "confirmed" | "review_required" | "not_found" | "not_applicable";
  score: number;
  itemSeq: NullableText;
  productKey: NullableText;
  identityValid: boolean;
  checkedAt: NullableText;
  sourceType: NullableText;
  sourceUrl: NullableText;
  alternatives: {
    itemName: string;
    itemSeq: string;
    manufacturer: NullableText;
    dosageForm: NullableText;
    packUnit: NullableText;
    sourceUrl: NullableText;
    score: number;
    conflicts: TextArray;
  }[];
  evidence: {
    detailPageVerified: boolean;
    ajaxPayloadVerified: boolean;
    matchReasons: TextArray;
    conflicts: TextArray;
    sourceUrls: TextArray;
    verifiedFields: TextArray;
    pipelineVersion: NullableText;
  };
}
export interface OfficialProduct {
  itemSeq: string;
  productKey: string;
  itemName: string;
  englishName: NullableText;
  manufacturer: string;
  manufacturerDetails: ManufacturerDetails;
  sourceType: string;
  sourceUrl: string;
  otcStatus: "otc" | "not_otc" | "unknown";
  permit: {
    permitDate: NullableText;
    cancelled: boolean;
    cancelDate: NullableText;
  };
  classification: {
    category: NullableText;
    code: NullableText;
    atcCode: NullableText;
    kpicAtc: NullableText;
  };
  dosageForm: NullableText;
  route: NullableText;
  packUnit: NullableText;
  storage: NullableText;
  validTerm: NullableText;
  appearance: NullableText;
  efficacy: NullableText;
  dosage: NullableText;
  precautions: NullableText;
  professionalPrecautions: NullableText;
  content: OfficialContent;
  ingredients: IngredientSource[];
  activeIngredients: IngredientSource[];
  additives: TextArray;
  insurance: {
    status: NullableText;
    detail: NullableText;
    history: {
      code: NullableText;
      detail: NullableText;
    }[];
    reimbursementCriteria: NullableText;
  };
  consumerGuidance: {
    summary: NullableText;
    guide: NullableText;
    patientGuidance: NullableText;
    medicationGuide: NullableText;
    sourceUrl: NullableText;
  };
  identification: NullableText;
  interactions: {
    tableIndex: number;
    cells: TextArray;
  }[];
  sameIngredientProducts: {
    productName: NullableText;
    manufacturer: NullableText;
    otcStatus: NullableText;
    price: NullableText;
    bioequivalence: NullableText;
    supplied: NullableText;
    tableIndex: number | null;
    cells: TextArray;
  }[];
  insertPdfUrl: NullableText;
  dur: Dur;
  images: Media[];
  pictograms: Media[];
  contentStatus: NullableText;
  upstreamUpdatedAt: NullableText;
}
export interface ManufacturerDetails {
  name: NullableText;
  englishName: NullableText;
  address: NullableText;
  phone: NullableText;
  fax: NullableText;
  website: NullableText;
}
export interface OfficialContent {
  schemaVersion: "1.0";
  normalizationVersion: string;
  efficacy: null | ContentSection;
  dosage: null | ContentSection;
  precautions: null | ContentSection;
  professionalPrecautions: null | ContentSection;
  patientGuidance: null | ContentSection;
  medicationGuide: null | ContentSection;
}
export interface ContentSection {
  text: string;
  blocks: ContentBlock[];
}
export interface IngredientSource {
  sourceText: string;
  sourceIngredientCode: NullableText;
  sourceUrl: NullableText;
  ingredientId: NullableText;
}
export interface Dur {
  contraindications: DurSection;
  age: DurSection;
  pregnancy: DurSection;
  senior: DurSection;
  maxDose: DurSection;
  maxPeriod: DurSection;
  splitDosage: DurSection;
  pregnancyCategory: null | {
    code: string;
    description: NullableText;
  };
}
export interface DurSection {
  present: boolean;
  entries: TextArray;
  raw: NullableText;
}
export interface Media {
  url: string;
  kind: NullableText;
  sourceUrl: NullableText;
  sourceDatasetId: NullableText;
  license: NullableText;
  fetchedAt: NullableText;
}
export interface Recommendation {
  productId: string;
  ingredientIds: string[];
  ingredientMappings: {
    ingredientId: NullableText;
    sourceText: string;
  }[];
  unmappedActiveIngredients: TextArray;
  protocolIds: string[];
  optionIds: string[];
  clinicalGroupKey: NullableText;
  eligible: boolean;
  exclusionReasons: (
    | "official_match_not_confirmed"
    | "official_identity_invalid"
    | "not_otc"
    | "permit_cancelled"
    | "source_match_conflict"
    | "active_ingredient_missing"
    | "active_ingredient_unmapped"
    | "protocol_indication_mismatch"
  )[];
}
