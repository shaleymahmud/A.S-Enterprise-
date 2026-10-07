export type MonType = 40 | 41 | 42 | 43;

export interface Calculation {
  id: string;
  timestamp: number;
  sellerName: string;
  totalKg: number;
  monType: MonType;
  ratePerMon: number;
  totalMon: number;
  totalPrice: number;
  challanNo: number;
  createdBy: string;
  createdByName?: string;
  deductedWeight?: number;
  deductionPercentage?: number;
  isMinusCalculated?: boolean;
  targetMonPrice?: number;
  getEntryNo?: number;
  gateEntry?: number;
  gateEntryNo?: number;
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: number;
  // Android compatibility & display fields
  weightKg?: number;
  rate?: number;
  totalAmount?: number;
  monDetails?: string;
  operatorEmail?: string;
  sellerPhone?: string;
  date?: string;
  sourceDevice?: 'web' | 'android';
  isAndroid?: boolean;
  // Detailed Calculation Body fields
  netKg?: number;
  monCount?: number;
  extraKg?: number;
  calculationBody?: string;
  expression?: string;
  items?: any[];
  rawSnapshot?: Record<string, any>;
}

export interface CalculationDisplay {
  grossKg: number | null;
  netKg: number | null;
  monType: number | null;
  monCount: number | null;
  extraKg: number | null;
  ratePerMon: number | null;
  totalPrice: number | null;
  weightDisplay: string;
  monDisplay: string;
  rateDisplay: string;
  totalPriceDisplay: string;
  dateDisplay: string;
  timeDisplay: string;
  challanDisplay: string;
  gateEntryDisplay: string | null;
  sellerDisplay: string;
  operatorDisplay: string;
  isAndroid: boolean;
  hasMinus: boolean;
  deductedKg: number;
}

/**
 * Parses date strings in various formats (e.g., "DD/MM/YYYY" or "01 Oct 2026") into numeric timestamp
 */
export function parseDateStringToTimestamp(dateStr: unknown): number {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const trimmed = dateStr.trim();
  
  // Format 1: DD/MM/YYYY (e.g. 01/10/2026 or 10/07/2026)
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day, 12, 0, 0, 0);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // Format 2: "01 Oct 2026" or standard parseable dates
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) return parsed;

  return 0;
}

/**
 * Normalizes raw Firestore document data from either Web or Android
 * into a single unified, complete, and resilient Calculation model.
 * Guarantees NO NaN and preserves/computes the COMPLETE calculation body.
 */
export function normalizeCalculation(raw: any, docId: string): Calculation {
  if (!raw || typeof raw !== 'object') {
    return {
      id: docId,
      timestamp: Date.now(),
      sellerName: 'অজ্ঞাত বিক্রেতা',
      totalKg: 0,
      netKg: 0,
      monType: 41,
      monCount: 0,
      extraKg: 0,
      ratePerMon: 0,
      totalMon: 0,
      totalPrice: 0,
      challanNo: 0,
      createdBy: 'Guest',
      isDeleted: false,
      sourceDevice: 'web',
      isAndroid: false
    };
  }

  // Technical Document ID is strictly the Firestore Document ID
  const id = docId || raw.id || '';

  // Detect whether this document originated from Android
  const isAndroid = Boolean(
    raw.source === 'android' ||
    raw.sourceDevice === 'android' ||
    raw.weightKg !== undefined ||
    raw.totalAmount !== undefined ||
    raw.operatorEmail !== undefined ||
    raw.gateEntryNo !== undefined ||
    raw.monDetails !== undefined ||
    (typeof raw.id === 'string' && /^\d+$/.test(raw.id))
  );

  // 1. Weight: Web 'totalKg' vs Android 'weightKg'
  const rawTotalKg = raw.totalKg !== undefined ? raw.totalKg : raw.weightKg;
  let totalKg = typeof rawTotalKg === 'number' && !isNaN(rawTotalKg)
    ? rawTotalKg
    : (rawTotalKg !== undefined && rawTotalKg !== null && String(rawTotalKg).trim() !== '' ? parseFloat(String(rawTotalKg)) : NaN);
  
  if (isNaN(totalKg) || totalKg < 0) {
    // If weight is missing, can it be computed from monDetails or totalAmount?
    if (raw.monDetails && typeof raw.monDetails === 'string') {
      const match = raw.monDetails.match(/^(\d+)\s*M\s*(\d+(?:\.\d+)?)\s*KG$/i);
      if (match) {
        const m = parseInt(match[1], 10);
        const kg = parseFloat(match[2]);
        totalKg = (m * 41) + kg;
      }
    }
  }
  if (isNaN(totalKg) || totalKg < 0) totalKg = 0;

  // 2. Deduction / Minus
  const rawDeductedWeight = raw.deductedWeight;
  let deductedWeight = typeof rawDeductedWeight === 'number' && !isNaN(rawDeductedWeight)
    ? rawDeductedWeight
    : (rawDeductedWeight ? parseFloat(String(rawDeductedWeight)) : 0);
  if (isNaN(deductedWeight) || deductedWeight < 0) deductedWeight = 0;
  
  const isMinusCalculated = Boolean(raw.isMinusCalculated || (deductedWeight > 0));
  const netKg = isMinusCalculated ? Math.max(0, totalKg - deductedWeight) : totalKg;

  // 3. Mon Type: Web 'monType' (40, 41, 42, 43) vs Android 'monDetails' inference
  let monType: MonType = 41; // Standard firewood Mon size (41 KG/মন)
  let monTypeDetermined = false;
  if (raw.monType === 40 || raw.monType === 41 || raw.monType === 42 || raw.monType === 43) {
    monType = raw.monType;
    monTypeDetermined = true;
  } else if (raw.monDetails && typeof raw.monDetails === 'string' && netKg > 0) {
    // Android format: "22 M 13 KG" -> (netKg - extraKg) / monCount
    const match = raw.monDetails.match(/^(\d+)\s*M\s*(\d+(?:\.\d+)?)\s*KG$/i);
    if (match) {
      const m = parseInt(match[1], 10);
      const kg = parseFloat(match[2]);
      if (m > 0 && netKg > kg) {
        const inferred = (netKg - kg) / m;
        const rounded = Math.round(inferred);
        if (Math.abs(inferred - rounded) < 0.1 && (rounded === 40 || rounded === 41 || rounded === 42 || rounded === 43)) {
          monType = rounded as MonType;
          monTypeDetermined = true;
        }
      }
    }
  }
  
  if (!monTypeDetermined && netKg > 0) {
    // Try to infer from totalAmount / rate
    const tot = raw.totalPrice !== undefined ? raw.totalPrice : raw.totalAmount;
    const r = raw.ratePerMon !== undefined ? raw.ratePerMon : raw.rate;
    if (typeof tot === 'number' && typeof r === 'number' && tot > 0 && r > 0) {
      const tMon = tot / r;
      if (tMon > 0) {
        const inf = netKg / tMon;
        const rounded = Math.round(inf);
        if (Math.abs(inf - rounded) < 0.1 && (rounded === 40 || rounded === 41 || rounded === 42 || rounded === 43)) {
          monType = rounded as MonType;
          monTypeDetermined = true;
        }
      }
    }
  }

  // 4. Rate per Mon: Web 'ratePerMon' vs Android 'rate'
  const rawRate = raw.ratePerMon !== undefined ? raw.ratePerMon : raw.rate;
  let ratePerMon = typeof rawRate === 'number' && !isNaN(rawRate)
    ? rawRate
    : (rawRate ? parseFloat(String(rawRate)) : NaN);
  if (isNaN(ratePerMon) || ratePerMon < 0) ratePerMon = 0;

  // 5. Total Price / Amount: Web 'totalPrice' vs Android 'totalAmount'
  const rawTotalPrice = raw.totalPrice !== undefined ? raw.totalPrice : raw.totalAmount;
  let totalPrice = typeof rawTotalPrice === 'number' && !isNaN(rawTotalPrice)
    ? rawTotalPrice
    : (rawTotalPrice ? parseFloat(String(rawTotalPrice)) : NaN);

  if ((isNaN(totalPrice) || totalPrice === 0) && netKg > 0 && ratePerMon > 0 && monType > 0) {
    totalPrice = (netKg / monType) * ratePerMon;
  } else if (isNaN(totalPrice)) {
    totalPrice = 0;
  }

  // 6. Total Mon (Decimal representation)
  let totalMon = typeof raw.totalMon === 'number' && !isNaN(raw.totalMon)
    ? raw.totalMon
    : (raw.totalMon ? parseFloat(String(raw.totalMon)) : NaN);
  if (isNaN(totalMon) || totalMon === 0) {
    totalMon = monType > 0 ? netKg / monType : 0;
  }

  // 7. Mon Details string & exact units breakdown
  let monCount = monType > 0 ? Math.floor(netKg / monType) : 0;
  let extraKg = monType > 0 ? parseFloat((netKg % monType).toFixed(2)) : 0;
  
  let monDetails = '';
  if (raw.monDetails && typeof raw.monDetails === 'string' && raw.monDetails.trim()) {
    monDetails = raw.monDetails.trim();
    const match = monDetails.match(/^(\d+)\s*M\s*(\d+(?:\.\d+)?)\s*KG$/i);
    if (match) {
      monCount = parseInt(match[1], 10);
      extraKg = parseFloat(match[2]);
    }
  } else {
    monDetails = `${monCount} M ${extraKg} KG`;
  }

  // 8. Challan Number
  const rawChallan = raw.challanNo;
  let challanNo = typeof rawChallan === 'number' && !isNaN(rawChallan)
    ? rawChallan
    : parseInt(String(rawChallan || 0), 10);
  if (isNaN(challanNo)) challanNo = 0;

  // 9. Gate Entry Number: Web 'getEntryNo' / 'gateEntry' vs Android 'gateEntryNo'
  const rawGate = raw.getEntryNo !== undefined 
    ? raw.getEntryNo 
    : (raw.gateEntryNo !== undefined ? raw.gateEntryNo : raw.gateEntry);
  let getEntryNo = typeof rawGate === 'number' && !isNaN(rawGate)
    ? rawGate
    : (parseInt(String(rawGate || ''), 10) || undefined);
  if (getEntryNo !== undefined && isNaN(getEntryNo)) {
    getEntryNo = undefined;
  }

  // 10. Operator & CreatedBy: Web 'createdBy' / 'createdByName' vs Android 'operatorEmail'
  const operatorEmail = (raw.operatorEmail && typeof raw.operatorEmail === 'string') 
    ? raw.operatorEmail.trim() 
    : '';
  const createdBy = (raw.createdBy && typeof raw.createdBy === 'string' && raw.createdBy.trim())
    ? raw.createdBy.trim()
    : (operatorEmail || 'Guest');
  
  const createdByName = raw.createdByName || (
    operatorEmail 
      ? operatorEmail.split('@')[0] 
      : (createdBy.includes('@') ? createdBy.split('@')[0] : createdBy)
  );

  // 11. Timestamp & Date string
  let timestamp = typeof raw.timestamp === 'number' && !isNaN(raw.timestamp) ? raw.timestamp : 0;
  if (!timestamp && raw.date && typeof raw.date === 'string') {
    const parsedDate = parseDateStringToTimestamp(raw.date);
    if (parsedDate) timestamp = parsedDate;
  }
  if (!timestamp) {
    timestamp = Date.now();
  }

  // 12. Seller Information
  const sellerName = (raw.sellerName && typeof raw.sellerName === 'string' && raw.sellerName.trim()) 
    ? raw.sellerName.trim() 
    : 'অজ্ঞাত বিক্রেতা';
  const sellerPhone = (raw.sellerPhone && typeof raw.sellerPhone === 'string')
    ? raw.sellerPhone.trim()
    : '';

  // 13. Soft Deletion Flag
  const isDeleted = Boolean(raw.isDeleted === true);
  const deletedBy = raw.deletedBy || (isDeleted ? (operatorEmail || createdBy) : undefined);
  const deletedAt = typeof raw.deletedAt === 'number' ? raw.deletedAt : undefined;

  // 14. Calculation Body string formulation
  const bodyText = raw.calculationBody || (
    isMinusCalculated 
      ? `মোট ওজন: ${totalKg} KG - কর্তন: ${deductedWeight} KG = নিট: ${netKg} KG | রূপান্তর: ${monCount} মন ${extraKg} কেজি (${monType} KG/মন) | দর: ৳${ratePerMon} | মোট: ৳${Math.round(totalPrice).toLocaleString()}`
      : `ওজন: ${totalKg} KG ÷ ${monType} KG/মন = ${monCount} মন ${extraKg} কেজি (${totalMon.toFixed(2)} মন) × ৳${ratePerMon} = ৳${Math.round(totalPrice).toLocaleString()}`
  );

  return {
    ...raw,
    id,
    isAndroid,
    sourceDevice: isAndroid ? 'android' : 'web',
    challanNo,
    getEntryNo,
    gateEntry: getEntryNo,
    gateEntryNo: getEntryNo,
    sellerName,
    sellerPhone,
    totalKg,
    weightKg: totalKg,
    netKg,
    monType,
    monCount,
    extraKg,
    ratePerMon,
    rate: ratePerMon,
    totalMon,
    totalPrice,
    totalAmount: totalPrice,
    monDetails,
    calculationBody: bodyText,
    timestamp,
    date: raw.date || new Date(timestamp).toLocaleDateString('en-GB'),
    createdBy,
    createdByName,
    operatorEmail: operatorEmail || createdBy,
    deductedWeight,
    deductionPercentage: typeof raw.deductionPercentage === 'number' && !isNaN(raw.deductionPercentage) ? raw.deductionPercentage : 0,
    isMinusCalculated,
    targetMonPrice: typeof raw.targetMonPrice === 'number' && !isNaN(raw.targetMonPrice) ? raw.targetMonPrice : undefined,
    isDeleted,
    deletedBy,
    deletedAt,
    rawSnapshot: raw
  };
}

/**
 * Returns safe, beautifully formatted display properties for ANY calculation record.
 * Guarantees NO NaN, NO undefined, and NO Invalid Date across tables and cards.
 * If data truly does not exist in Firebase, returns "—" rather than a fake zero or broken string.
 */
export function getCalculationDisplay(calc: any, language: 'bn' | 'en' = 'en'): CalculationDisplay {
  if (!calc || typeof calc !== 'object') {
    return {
      grossKg: null,
      netKg: null,
      monType: null,
      monCount: null,
      extraKg: null,
      ratePerMon: null,
      totalPrice: null,
      weightDisplay: '—',
      monDisplay: '—',
      rateDisplay: '—',
      totalPriceDisplay: '—',
      dateDisplay: '—',
      timeDisplay: '—',
      challanDisplay: '---',
      gateEntryDisplay: null,
      sellerDisplay: 'অজ্ঞাত বিক্রেতা',
      operatorDisplay: 'Guest',
      isAndroid: false,
      hasMinus: false,
      deductedKg: 0
    };
  }

  // 1. Weight
  let grossKg: number | null = null;
  const rawWeight = calc.totalKg !== undefined ? calc.totalKg : calc.weightKg;
  if (typeof rawWeight === 'number' && !isNaN(rawWeight)) {
    grossKg = rawWeight;
  } else if (rawWeight !== undefined && rawWeight !== null && String(rawWeight).trim() !== '') {
    const p = parseFloat(String(rawWeight));
    if (!isNaN(p)) grossKg = p;
  }

  // 2. Deduction
  const rawDed = calc.deductedWeight;
  let deductedKg = 0;
  if (typeof rawDed === 'number' && !isNaN(rawDed)) deductedKg = rawDed;
  else if (rawDed) {
    const p = parseFloat(String(rawDed));
    if (!isNaN(p)) deductedKg = p;
  }
  const hasMinus = Boolean(calc.isMinusCalculated || deductedKg > 0);
  const netKg = grossKg !== null ? Math.max(0, grossKg - deductedKg) : null;

  // 3. MonType
  let monType: number | null = null;
  if (calc.monType !== undefined) {
    const m = Number(calc.monType);
    if (!isNaN(m) && m > 0) monType = m;
  }
  // Infer from monDetails if available
  if (monType === null && calc.monDetails && typeof calc.monDetails === 'string' && netKg !== null) {
    const match = calc.monDetails.match(/^(\d+)\s*M\s*(\d+(?:\.\d+)?)\s*KG$/i);
    if (match) {
      const m = parseInt(match[1], 10);
      const kg = parseFloat(match[2]);
      if (m > 0 && netKg > kg) {
        const inf = (netKg - kg) / m;
        const rounded = Math.round(inf);
        if (Math.abs(inf - rounded) < 0.1 && (rounded === 40 || rounded === 41 || rounded === 42 || rounded === 43)) {
          monType = rounded;
        }
      }
    }
  }
  // Infer from totalAmount / rate
  if (monType === null && netKg !== null) {
    const tot = calc.totalPrice !== undefined ? calc.totalPrice : calc.totalAmount;
    const r = calc.ratePerMon !== undefined ? calc.ratePerMon : calc.rate;
    if (typeof tot === 'number' && typeof r === 'number' && tot > 0 && r > 0) {
      const inf = netKg / (tot / r);
      const rounded = Math.round(inf);
      if (Math.abs(inf - rounded) < 0.1 && (rounded === 40 || rounded === 41 || rounded === 42 || rounded === 43)) {
        monType = rounded;
      }
    }
  }

  // 4. Mon Breakdown
  let monCount: number | null = null;
  let extraKg: number | null = null;
  let monDisplay = '—';
  if (calc.monDetails && typeof calc.monDetails === 'string' && calc.monDetails.trim()) {
    monDisplay = calc.monDetails.trim();
    const match = monDisplay.match(/^(\d+)\s*M\s*(\d+(?:\.\d+)?)\s*KG$/i);
    if (match) {
      monCount = parseInt(match[1], 10);
      extraKg = parseFloat(match[2]);
    }
  } else if (netKg !== null && monType !== null && monType > 0) {
    monCount = Math.floor(netKg / monType);
    extraKg = parseFloat((netKg % monType).toFixed(2));
    monDisplay = `${monCount} M ${extraKg} KG`;
  }

  // 5. Rate
  let ratePerMon: number | null = null;
  const rawRate = calc.ratePerMon !== undefined ? calc.ratePerMon : calc.rate;
  if (typeof rawRate === 'number' && !isNaN(rawRate)) ratePerMon = rawRate;
  else if (rawRate) {
    const p = parseFloat(String(rawRate));
    if (!isNaN(p)) ratePerMon = p;
  }

  // 6. Total Price
  let totalPrice: number | null = null;
  const rawTotal = calc.totalPrice !== undefined ? calc.totalPrice : calc.totalAmount;
  if (typeof rawTotal === 'number' && !isNaN(rawTotal)) totalPrice = rawTotal;
  else if (rawTotal) {
    const p = parseFloat(String(rawTotal));
    if (!isNaN(p)) totalPrice = p;
  }

  // Mathematical reconstruction if one of (rate, total) is missing and the other exists
  if (totalPrice === null && netKg !== null && monType !== null && ratePerMon !== null && monType > 0) {
    totalPrice = (netKg / monType) * ratePerMon;
  }
  if (ratePerMon === null && totalPrice !== null && netKg !== null && monType !== null && netKg > 0) {
    ratePerMon = Math.round(((totalPrice * monType) / netKg) * 100) / 100;
  }

  const rateDisplay = (ratePerMon !== null && !isNaN(ratePerMon)) ? `৳${ratePerMon}` : '—';
  const totalPriceDisplay = (totalPrice !== null && !isNaN(totalPrice)) ? `৳${Math.round(totalPrice).toLocaleString()}` : '—';

  // 7. Date & Time
  let timestamp = typeof calc.timestamp === 'number' && !isNaN(calc.timestamp) ? calc.timestamp : 0;
  if (!timestamp && calc.date && typeof calc.date === 'string') {
    timestamp = parseDateStringToTimestamp(calc.date);
  }
  let dateDisplay = '—';
  let timeDisplay = '—';
  if (timestamp > 0) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      dateDisplay = d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US');
      timeDisplay = d.toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    }
  } else if (calc.date && typeof calc.date === 'string') {
    dateDisplay = calc.date.trim();
  }

  const weightDisplay = grossKg !== null ? `${grossKg} KG` : '—';
  const challanDisplay = (calc.challanNo !== undefined && calc.challanNo !== null) ? `#${calc.challanNo}` : '---';
  
  const gateNo = calc.gateEntryNo !== undefined ? calc.gateEntryNo : (calc.getEntryNo !== undefined ? calc.getEntryNo : calc.gateEntry);
  const gateEntryDisplay = (gateNo !== undefined && gateNo !== null) 
    ? (language === 'bn' ? `গেট এন্ট্রি ${gateNo}` : `Get Entry ${gateNo}`) 
    : null;

  const isAndroid = Boolean(
    calc.isAndroid ||
    calc.sourceDevice === 'android' ||
    calc.weightKg !== undefined ||
    calc.totalAmount !== undefined ||
    calc.operatorEmail !== undefined ||
    calc.monDetails !== undefined
  );

  const sellerDisplay = (calc.sellerName && typeof calc.sellerName === 'string' && calc.sellerName.trim())
    ? calc.sellerName.trim()
    : 'অজ্ঞাত বিক্রেতা';

  const operatorDisplay = calc.createdByName || calc.operatorEmail || calc.createdBy || 'Guest';

  return {
    grossKg,
    netKg,
    monType,
    monCount,
    extraKg,
    ratePerMon,
    totalPrice,
    weightDisplay,
    monDisplay,
    rateDisplay,
    totalPriceDisplay,
    dateDisplay,
    timeDisplay,
    challanDisplay,
    gateEntryDisplay,
    sellerDisplay,
    operatorDisplay,
    isAndroid,
    hasMinus,
    deductedKg
  };
}

export interface CalculationSteps {
  grossKg: number;
  isMinus: boolean;
  deductedKg: number;
  deductionPct: number;
  netKg: number;
  monType: number;
  monCount: number;
  extraKg: number;
  monDetails: string;
  totalMon: number;
  ratePerMon: number;
  totalPrice: number;
  formulaString: string;
  sourceDevice: 'android' | 'web';
  formattedDate: string;
  formattedTime: string;
}

export function getCalculationSteps(calc: Calculation): CalculationSteps {
  const d = getCalculationDisplay(calc);

  const grossKg = d.grossKg || 0;
  const isMinus = d.hasMinus;
  const deductedKg = d.deductedKg;
  const netKg = d.netKg !== null ? d.netKg : grossKg;
  const monType = d.monType || 41;
  const monCount = d.monCount !== null ? d.monCount : 0;
  const extraKg = d.extraKg !== null ? d.extraKg : 0;
  const monDetails = d.monDisplay !== '—' ? d.monDisplay : `${monCount} M ${extraKg} KG`;
  const ratePerMon = d.ratePerMon || 0;
  const totalPrice = d.totalPrice || 0;
  const totalMon = monType > 0 ? (netKg / monType) : 0;
  const deductionPct = grossKg > 0 ? (deductedKg / grossKg) * 100 : 0;

  const formulaString = isMinus
    ? `(${grossKg} KG - ${deductedKg} KG) ÷ ${monType} × ৳${ratePerMon} = ৳${Math.round(totalPrice).toLocaleString()}`
    : `(${grossKg} KG ÷ ${monType}) × ৳${ratePerMon} = ৳${Math.round(totalPrice).toLocaleString()}`;

  return {
    grossKg,
    isMinus,
    deductedKg,
    deductionPct,
    netKg,
    monType,
    monCount,
    extraKg,
    monDetails,
    totalMon,
    ratePerMon,
    totalPrice,
    formulaString,
    sourceDevice: d.isAndroid ? 'android' : 'web',
    formattedDate: d.dateDisplay,
    formattedTime: d.timeDisplay
  };
}
