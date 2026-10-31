const RADAR_DIMENSION_DESCRIPTIONS = {
  Skills: 'Coverage and importance of matched, partial, and missing technical or role-specific skills.',
  Experience: 'Relevance, duration, and scope of prior work compared with the experience requested for the role.',
  Seniority: 'Alignment of ownership, complexity, autonomy, and leadership evidence with the role level.',
  Domain: 'Relevant industry, product, customer, or problem-space experience found in the candidate evidence.',
  Culture: 'Evidence of the communication, collaboration, adaptability, and other soft skills requested by the employer.',
  Education: 'Alignment of degrees, certifications, and equivalent learning with stated job requirements.',
};

/** Builds score explanations, preferring evidence-backed AI rationales when available. */
export const getRadarExplanationItems = (dimensions, candidate, expectation, rationales = []) => {
  const rationalesByDimension = new Map(
    rationales.map(rationale => [rationale.dimension, rationale]),
  );

  return dimensions.map((dimension, index) => {
    const rationale = rationalesByDimension.get(dimension);

    return {
      dimension,
      candidateScore: candidate[index],
      expectationScore: expectation[index],
      description: RADAR_DIMENSION_DESCRIPTIONS[dimension]
        || 'Candidate evidence compared with the corresponding job requirement.',
      candidateReason: rationale?.candidate_reason || 'A specific score rationale is not available for this saved analysis. Sync the analysis to generate one.',
      expectationReason: rationale?.expectation_reason || 'A specific expectation rationale is not available for this saved analysis. Sync the analysis to generate one.',
    };
  });
};
