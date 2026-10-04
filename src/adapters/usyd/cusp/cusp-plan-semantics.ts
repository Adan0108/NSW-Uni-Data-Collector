/** A source position is one allocation, even when it lists multiple alternatives. */
export function isCuspChoice(item: { subjects?: unknown[]; rawText?: string | null }): boolean {
  return (item.subjects?.length ?? 0) !== 1 || /^Select from\b/i.test(item.rawText?.trim() ?? '');
}

export function classifyCuspVariant(plan: {
  cuspStreamId?: string | null; variantTitle?: string | null;
}): 'BASE' | 'STREAM_SPECIALISATION' | 'BREADTH_SPECIALISATION' | 'OTHER' {
  if (!plan.cuspStreamId || plan.cuspStreamId === '0') return 'BASE';
  const title = plan.variantTitle ?? '';
  if (/alternate thesis|MIPPS/i.test(title)) return 'OTHER';
  if (/Breadth Specialisation\b/i.test(title)) return 'BREADTH_SPECIALISATION';
  // Biomedical and Environmental variants omit the literal word "Stream".
  if (/\bSpecialisation in\b/i.test(title)) return 'STREAM_SPECIALISATION';
  return 'OTHER';
}

/** Only the verified full-unit mathematics anomalies are overridden, never split slots. */
export function repairCuspMathematicsAllocation<T extends {
  subjects?: Array<{ code?: string | null }>; creditPoints?: number | null; rawText?: string | null;
}>(item: T, degreeVersionId?: string | null, canonicalSubject?: { creditPoints?: number; sourceUrl?: string }): T {
  const code = item.subjects?.[0]?.code;
  const verified = (degreeVersionId === '6436' && (code === 'MATH1061' || code === 'MATH1062'))
    || (degreeVersionId === '6669' && code === 'MATH1062');
  if (verified && !isCuspChoice(item) && item.creditPoints === 3) {
    // The HTML parser uses verified official evidence; local master generation
    // additionally requires the canonical subject to agree before writing.
    const creditPoints = canonicalSubject?.creditPoints ?? 6;
    if (creditPoints !== 6) throw new Error(`Unexpected canonical CP for ${code}: ${creditPoints}`);
    return { ...item, creditPoints, sourceCreditPoints: 3,
      creditPointEvidenceUrl: canonicalSubject?.sourceUrl ?? `https://www.sydney.edu.au/units/${code}` };
  }
  return item;
}
