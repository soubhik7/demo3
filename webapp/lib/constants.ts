export const VALID_TX_CODES: Record<string, string> = {
  sal_008: 'SHIPMENT',
  sal_011: 'SALES_RETURN_RECEIPT',
  pur_019: 'RECADV',
  man_001: 'FINISHED_GOOD',
  inv_002: 'RECLASSMENT',
  inv_003: 'INVENTORY',
  inv_004: 'STOCK_ADJUSTMENT',
  wms_004: 'TO_SHIP_CONFIRMATION',
  wms_005: 'TO_REC_CONFIRMATION',
};

export const TX_CODE_ORDER = Object.keys(VALID_TX_CODES);

export const TRANSLATION_COLUMNS = [
  'ReceiverName', 'MessageType', 'TranslationSchema', 'TranslationName',
  'ValueFrom', 'ValueTo', 'Created By', 'Modified By', 'Modified',
  'Item Type', 'Path',
] as const;

export const SHAREPOINT_PATH = 'sites/pubsubpatterntesting/Lists/TranslationData_TST';
