import {
  writeUsydDegreeRequirementEnrichmentV2,
} from './usyd.degree-requirement-enrichment';

writeUsydDegreeRequirementEnrichmentV2()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
