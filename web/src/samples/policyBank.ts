/**
 * Curated policy / intervention bank — NOT pipeline output (there is no GEE lane
 * for policy). This is an ILLUSTRATIVE SAMPLE bank to be reviewed and curated
 * with Save Vietnam's Wildlife / legal input before any real use; descriptions
 * are generalised and sources name the instrument, not a citation. Each entry is
 * tagged with the loss `driver` it addresses, so the G2 matcher can map detected
 * drivers to interventions without reshaping this data.
 */

/** Loss drivers, matching the habitat-loss sample metrics (driver_*). */
export type PolicyDriver = 'mining' | 'farming' | 'other'

export interface PolicyIntervention {
  id: string
  driver: PolicyDriver
  name: string
  /** Short jurisdiction label shown as a chip. */
  country: string
  description: string
  source: string
  howItFits: string
  limitations: string
}

export const policyBank: PolicyIntervention[] = [
  {
    id: 'pa-buffer-mining',
    driver: 'mining',
    name: 'Protected-area buffer-zone extraction limits',
    country: 'Vietnam',
    description:
      'Restricts new mineral-extraction licences within designated buffer zones around protected karst areas.',
    source: 'Protected-area / buffer-zone regulations (instrument — sample)',
    howItFits:
      'Targets the quarrying pressure flagged as a loss driver near suspected habitat.',
    limitations:
      'Enforcement varies locally; existing licences may be grandfathered. Screening flags are not a legal basis on their own.',
  },
  {
    id: 'mineral-law-eia',
    driver: 'mining',
    name: 'Mineral-law EIA & site-rehabilitation requirements',
    country: 'Vietnam',
    description:
      'Requires environmental impact assessment and rehabilitation bonds before and after quarrying activity.',
    source: 'Mineral Law & EIA provisions (instrument — sample)',
    howItFits:
      'Attaches rehabilitation obligations to the registered quarry footprint seen in the loss step.',
    limitations:
      'Applies mainly to formal operations; informal extraction is harder to reach. Bond levels may under-price habitat value.',
  },
  {
    id: 'pfes',
    driver: 'farming',
    name: 'Payment for Forest Environmental Services (PFES)',
    country: 'Vietnam',
    description:
      'Pays communities to maintain forest cover, offering an income alternative to clearing land for agriculture.',
    source: 'PFES programme (instrument — sample)',
    howItFits:
      'Addresses the farming / clearing driver by rewarding retained cover near affected blocks.',
    limitations:
      'Payment levels may not offset agricultural returns; coverage and disbursement can be uneven.',
  },
  {
    id: 'agroforestry',
    driver: 'farming',
    name: 'Agroforestry & sustainable land-use incentives',
    country: 'Vietnam / Regional',
    description:
      'Promotes mixed tree-crop systems on existing farmland to reduce expansion onto karst slopes.',
    source: 'Sustainable land-use / agroforestry programmes (instrument — sample)',
    howItFits:
      'Reduces the incentive to convert slope habitat by raising returns on land already farmed.',
    limitations:
      'Adoption is gradual and needs extension support; benefits accrue over years, not immediately.',
  },
  {
    id: 'critical-habitat-designation',
    driver: 'other',
    name: 'Biodiversity-law critical-habitat designation',
    country: 'Vietnam',
    description:
      'Legal mechanism to designate and protect critical habitat of endangered species.',
    source: 'Biodiversity Conservation Law (instrument — sample)',
    howItFits:
      'Could formalise protection for suspected Delacour’s langur karst habitat once field-verified.',
    limitations:
      'Designation is slow and requires verified evidence — a screening product cannot trigger it alone.',
  },
  {
    id: 'community-forest-contracts',
    driver: 'other',
    name: 'Community-based forest-protection contracts',
    country: 'Vietnam',
    description:
      'Local stewardship agreements that fund patrols and monitoring of priority forest blocks.',
    source: 'Community forest-management contracts (instrument — sample)',
    howItFits:
      'Puts monitoring capacity near the blocks the earlier steps flag as changing.',
    limitations:
      'Depends on sustained funding and local capacity; patrol coverage may be partial.',
  },
]
