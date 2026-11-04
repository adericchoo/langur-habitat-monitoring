import RiskPanel from '../components/RiskPanel'

/** Step 03 — Habitat risk. The sidebar is the RiskPanel component; the map
 *  highlight (step-driven risk fill) is wired in MapStage via `activeStep`.
 *  Composite risk is upstream TODO — RiskPanel renders screening-grade sample
 *  data shaped to types/risk.ts. */
export default function HabitatRiskStep() {
  return <RiskPanel />
}
