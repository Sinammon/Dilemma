// Reviewed public reference material only. Never contains imported listings.
// Scope is deliberately narrow: add a reviewed profile rather than guessing a nearby year.
const reviewed = '2026-10-29';
export const MODEL_PROFILES = [
  {
    id: 'thunderbird-2002', title: '2002 Ford Thunderbird', year: 2002, make: 'Ford',
    models: ['Thunderbird'], bodies: ['Convertible'],
    scope: '2002 North American two-seat convertible. Contemporary road tests describe new test cars; age, repairs and modifications can change the experience.',
    sources: [
      { id: 'thunderbird-road', publisher: 'Dan Jedlicka / Drive Chicago', title: '2002 Ford Thunderbird road test', url: 'https://www.drivechicago.com/reviews/article/704/road-test', reviewed, kind: 'Road-test opinion, US', locator: 'Cockpit, trunk, suspension and driving impressions' },
      { id: 'thunderbird-longterm', publisher: 'MotorTrend', title: '2002 Ford Thunderbird long-term test verdict', url: 'https://www.motortrend.com/reviews/2002-ford-thunderbird-3', reviewed, kind: 'Long-term test, one US vehicle', locator: 'Staff verdicts; problem areas in test-data table' },
    ],
    claims: [
      { id: 'thunderbird-strength', category: 'strengths', tone: 'positive', text: 'The road tester praises the comfortable seats and relaxed cruising character.', sourceIds: ['thunderbird-road'] },
      { id: 'thunderbird-comfort', category: 'comfort', tone: 'positive', text: 'The review describes a smooth ride, with some bouncing over dips.', sourceIds: ['thunderbird-road'] },
      { id: 'thunderbird-practical', category: 'practicality', tone: 'caution', text: 'The two-seat layout and shallow trunk limit passenger and luggage flexibility.', sourceIds: ['thunderbird-road'] },
      { id: 'thunderbird-performance', category: 'performance', tone: 'mixed', text: 'The tester finds responsive automatic shifts but positions it as a cruiser rather than a sports car.', sourceIds: ['thunderbird-road'] },
      { id: 'thunderbird-issues', category: 'issues', tone: 'caution', text: 'MotorTrend reported transmission-shift, CD-changer and shifter-trim problems on its long-term car. Check these during inspection; one test car does not establish failure frequency.', sourceIds: ['thunderbird-longterm'] },
    ],
  },
  {
    id: 'sprinter-2005', title: '2005 Dodge Sprinter', year: 2005, make: 'Dodge',
    models: ['Sprinter', 'Sprinter 2500', 'Sprinter 3500'], bodies: ['Van'], excludedVariants: ['Roadtrek', 'Winnebago', 'Airstream'],
    scope: '2005 North American Dodge van range. Passenger-test impressions are conditional; cargo vans and camper conversions differ. Seating, roof and wheelbase must be checked on the individual van.',
    sources: [
      { id: 'sprinter-review', publisher: 'Edmunds', title: '2005 Dodge Sprinter expert review', url: 'https://www.edmunds.com/dodge/sprinter/2005/review/', reviewed, kind: 'Editorial review, US', locator: 'Expert Review: Pros, Cons and Edmunds says; excludes owner reviews' },
      { id: 'sprinter-passenger', publisher: 'Auto123 / Mathieu St-Pierre', title: '2005 Dodge Sprinter Passenger (6 July 2005)', url: 'https://www.auto123.com/en/car-reviews/2005-dodge-sprinter-passenger/55743/', reviewed, kind: 'Passenger-van road test, Canada', locator: 'Styling: seating and crosswind sensitivity' },
    ],
    claims: [
      { id: 'sprinter-strength', category: 'strengths', tone: 'positive', text: 'Edmunds highlights its flexible body configurations and generous cargo space.', sourceIds: ['sprinter-review'] },
      { id: 'sprinter-comfort', category: 'comfort', tone: 'mixed', text: 'Auto123 found firm but comfortable seats in its passenger test van. This does not describe seating in a cargo van or conversion.', sourceIds: ['sprinter-passenger'] },
      { id: 'sprinter-practical', category: 'practicality', tone: 'positive', text: 'Edmunds praises cargo capacity and headroom; the actual configuration determines available space.', sourceIds: ['sprinter-review'] },
      { id: 'sprinter-performance', category: 'performance', tone: 'caution', text: 'Edmunds criticizes high-speed acceleration. Its work-van role differs from a passenger car.', sourceIds: ['sprinter-review'] },
      { id: 'sprinter-issues', category: 'issues', tone: 'caution', text: 'Auto123 notes crosswind sensitivity. Check stability and loading on a test drive; the reviewed sources do not establish common mechanical-failure rates.', sourceIds: ['sprinter-passenger'] },
    ],
  },
  {
    id: 'civic-2018', title: '2018 Honda Civic', year: 2018, make: 'Honda',
    models: ['Civic', 'Civic Sedan', 'Civic Coupe', 'Civic Hatchback'],
    bodies: ['Sedan', 'Coupe', 'Hatchback'], excludedVariants: ['Si', 'Type R'],
    scope: 'North American regular Civic range; excludes Si and Type R. Body, trim, market and condition affect the experience.',
    sources: [
      { id: 'civic-review', publisher: 'Car and Driver', title: '2018 Honda Civic review', url: 'https://www.caranddriver.com/honda/civic-2018', reviewed, kind: 'Road-test opinion', locator: 'Overview; Engine, Transmission, and Performance; Interior, Comfort, and Cargo' },
      { id: 'civic-ac', publisher: 'American Honda / NHTSA', title: 'Service Bulletin 19-091, version 4 (29 September 2020)', url: 'https://static.nhtsa.gov/odi/tsbs/2020/MC-10180616-0001.pdf', reviewed, kind: 'Manufacturer bulletin, US', locator: 'Page 1: affected 2016–2018 Civic vehicles, background and eligibility' },
    ],
    claims: [
      { id: 'civic-strength', category: 'strengths', tone: 'positive', text: 'The review praises the balance of everyday usability and enjoyable driving.', sourceIds: ['civic-review'] },
      { id: 'civic-comfort', category: 'comfort', tone: 'positive', text: 'Reviewers describe a compliant ride; some cabin materials receive criticism.', sourceIds: ['civic-review'] },
      { id: 'civic-practical', category: 'practicality', tone: 'mixed', text: 'The sedan is described as roomy, while the coupe has restricted rear space; the hatchback offers more cargo flexibility.', sourceIds: ['civic-review'] },
      { id: 'civic-performance', category: 'performance', tone: 'positive', text: 'The review praises steering response and chassis balance. Acceleration depends on the engine and transmission.', sourceIds: ['civic-review'] },
      { id: 'civic-issues', category: 'issues', tone: 'caution', text: 'Honda documented factory A/C condenser leaks for eligible 2016–2018 Civics. Test cooling and ask about repairs. This US bulletin does not establish Canadian coverage or a defect on this car.', sourceIds: ['civic-ac'] },
    ],
  },
  {
    id: 'corolla-sedan-2019', title: '2019 Toyota Corolla sedan', year: 2019, make: 'Toyota',
    models: ['Corolla', 'Corolla Sedan'], bodies: ['Sedan'], requireBody: true,
    scope: 'North American 2019 sedan only. The 2019 hatchback uses a different platform and is excluded. US trim impressions may differ in Canada.',
    sources: [
      { id: 'corolla-review', publisher: 'Car and Driver', title: '2019 Toyota Corolla review (sedan)', url: 'https://www.caranddriver.com/toyota/corolla-2019', reviewed, kind: 'Road-test opinion, US', locator: 'Engine, Transmission, and Performance; Interior, Comfort, and Cargo' },
      { id: 'corolla-recall', publisher: 'Toyota Canada', title: 'Recall involving certain Corolla, Matrix and Avalon vehicles (21 January 2020)', url: 'https://media.toyota.ca/en/releases/2020/toyota-is-conducting-a-safety-recall-involving-certain-corolla-matrix-and-avalon-vehicles.html', reviewed, kind: 'Manufacturer recall notice, Canada', locator: 'Affected 2011–2019 Corolla vehicles; airbag ECU electrical-noise protection' },
    ],
    claims: [
      { id: 'corolla-strength', category: 'strengths', tone: 'positive', text: 'The review highlights generous rear-passenger legroom.', sourceIds: ['corolla-review'] },
      { id: 'corolla-comfort', category: 'comfort', tone: 'mixed', text: 'Rear-seat space is a strength; the review criticizes cabin materials and the harsher ride of sport trims.', sourceIds: ['corolla-review'] },
      { id: 'corolla-practical', category: 'practicality', tone: 'positive', text: 'The tested sedan has a useful trunk shape, with a trade-off between rear legroom and trunk volume.', sourceIds: ['corolla-review'] },
      { id: 'corolla-performance', category: 'performance', tone: 'caution', text: 'The reviewer finds acceleration and driver engagement limited; sport trims change handling and ride.', sourceIds: ['corolla-review'] },
      { id: 'corolla-issues', category: 'issues', tone: 'caution', text: 'Toyota Canada recalled certain 2011–2019 Corollas for an airbag-control-unit concern. Ask a dealer to check VIN applicability and completion; this is not an open-recall result for this vehicle.', sourceIds: ['corolla-recall'] },
    ],
  },
  {
    id: 'mazda3-2017', title: '2017 Mazda3', year: 2017, make: 'Mazda',
    models: ['Mazda3', 'Mazda 3', '3', 'Mazda3 Sport', 'Mazda3 4-Door', 'Mazda3 5-Door'], bodies: ['Sedan', 'Hatchback'],
    scope: 'Canadian sedan/hatchback range as reviewed by CAA-Quebec; cargo observations concern the hatchback. The recall source is US-market documentation.',
    sources: [
      { id: 'mazda-review', publisher: 'CAA-Quebec', title: 'Mazda 3 2017 road test (24 February 2017)', url: 'https://www.caaquebec.com/en/advices/buying-or-selling-a-vehicle/road-tests/mazda-3-2017', reviewed, kind: 'Road test, Canada', locator: 'Pros and cons; Verdict; Body, cabin and cargo space; Ride and handling' },
      { id: 'mazda-wipers', publisher: 'Mazda North American Operations', title: 'Recall of certain 2016–2018 MY Mazda3 vehicles (15 April 2019)', url: 'https://news.mazdausa.com/2019-04-15-2019-statement-on-recall-of-certain-2016-2018-my-mazda3-vehicles', reviewed, kind: 'Manufacturer recall notice, US', locator: 'Front windshield wiper relay defect; affected model years' },
    ],
    claims: [
      { id: 'mazda-strength', category: 'strengths', tone: 'positive', text: 'CAA-Quebec praises steering, the driving position and interior finish.', sourceIds: ['mazda-review'] },
      { id: 'mazda-comfort', category: 'comfort', tone: 'mixed', text: 'CAA-Quebec finds the suspension well judged but criticizes sound isolation and restrictive rear seating.', sourceIds: ['mazda-review'] },
      { id: 'mazda-practical', category: 'practicality', tone: 'caution', text: 'Rear legroom is limited. The tested hatchback struggles with bulky cargo under its sloping rear window.', sourceIds: ['mazda-review'] },
      { id: 'mazda-performance', category: 'performance', tone: 'positive', text: 'The road test highlights agile handling and precise steering. This does not establish an acceleration time for this vehicle.', sourceIds: ['mazda-review'] },
      { id: 'mazda-issues', category: 'issues', tone: 'caution', text: 'Mazda documented a wiper relay failure affecting certain 2016–2018 Mazda3s in the US. Test wipers and check Canadian campaign applicability and completion with a dealer.', sourceIds: ['mazda-wipers'] },
    ],
  },
];
