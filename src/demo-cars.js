// Fictional inputs for an internet-independent school demo. Not saved eBay data.
export function makeDemoCars() {
  const make = (id, year, brand, model, price, km, specifics) => ({
    demo: true, legacyItemId: `demo-${id}`, title: `Fictional demo: ${year} ${brand} ${model}`,
    year: String(year), make: brand, model, priceCAD: { value: String(price), currency: 'CAD' },
    mileage: { raw: String(km), unit: 'km' }, images: [`/images/preview/${id === 'mazda' ? 'mazda3' : id}.jpg`], vin: null,
    description: 'Fictional demo input. Condition, service history and equipment have not been verified. No horsepower or comfort equipment is specified.',
    itemSpecifics: Object.entries(specifics).map(([name, value]) => ({ name, value })),
  });
  return [
    make('civic', 2018, 'Honda', 'Civic', 16000, 100000, { Engine: '2.0 L I4', Transmission: '6-speed manual', Drivetrain: 'FWD', 'Fuel type': 'Gasoline', 'Body type': 'Sedan' }),
    // CVT alone cannot distinguish AV from AV7. Demonstrates honest ambiguity.
    make('corolla', 2019, 'Toyota', 'Corolla', 18500, 80000, { Engine: '1.8 L I4', Transmission: 'CVT', Drivetrain: 'FWD', 'Fuel type': 'Gasoline', 'Body type': 'Sedan' }),
    make('mazda', 2017, 'Mazda', 'Mazda3', 14500, 115000, { Engine: '2.0 L I4', Transmission: '6-speed automatic', Drivetrain: 'FWD', 'Fuel type': 'Gasoline', 'Body type': 'Hatchback' }),
  ];
}
