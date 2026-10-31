import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useIsPresent, useReducedMotion } from 'motion/react';
import Icon from './Icons.jsx';

// Fictional scenarios never enter the real shortlist or decision engine.
// Photos show model examples, not these vehicles, years, or equipment.
const cars = [
  { id: 'corolla', name: 'Toyota Corolla', year: 2019, mileage: 67000, transmission: 'Automatic', city: 'Mississauga, ON', price: 18400, fuel: '7.5', highlight: 'Lowest mileage' },
  { id: 'civic', name: 'Honda Civic', year: 2018, mileage: 82000, transmission: 'Automatic', city: 'Toronto, ON', price: 16900, fuel: '7.0', highlight: 'Middle asking price' },
  { id: 'mazda3', name: 'Mazda3', year: 2017, mileage: 90000, transmission: 'Manual', city: 'Ottawa, ON', price: 14500, fuel: '7.4', highlight: 'Lowest asking price' },
  { id: 'jetta', name: 'VW Jetta', year: 2018, mileage: 110000, transmission: 'Automatic', city: 'Hamilton, ON', price: 15900 },
];
const compared = [cars[1], cars[0], cars[2]];
const stages = ['Import', 'Compare', 'Decide'];
const priorities = [
  { id: 'value', label: 'Best Value', car: cars[1], reason: 'A middle asking price and fewer kilometres than the cheapest example.', strengths: ['$1,500 below the Corolla', '8,000 fewer km than the Mazda3'], tradeoff: '$2,400 more than the Mazda3' },
  { id: 'cost', label: 'Lowest Cost', car: cars[2], reason: 'The lowest asking price leaves more room in the purchase budget.', strengths: ['Lowest example price: $14,500', '$2,400 less than the Civic'], tradeoff: '90,000 km; running costs are not known' },
  { id: 'comfort', label: 'Comfort', car: cars[0], reason: 'For this fictional scenario only, assume a test drive found this car the most comfortable.', strengths: ['Assumed test-drive preference', 'Automatic in this example'], tradeoff: 'Highest example asking price' },
  { id: 'balanced', label: 'Balanced', car: cars[1], reason: 'A compromise between the three example asking prices and mileages.', strengths: ['Middle price and mileage', 'Automatic in this example'], tradeoff: '15,000 more km than the Corolla' },
];
const money = value => `$${value.toLocaleString('en-CA')}`;
const photo = car => <img src={`/images/preview/${car.id}.jpg`} alt={`${car.name} model example; not an actual listing`} width="480" height="300" decoding="async" />;
const slideVariants = { enter: direction => ({ x: direction * 65, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: direction => ({ x: direction * -65, opacity: 0 }) };

function PreviewSlide({ stage, direction, reduced, children }) {
  const present = useIsPresent();
  return <m.div className={`showcase-slide showcase-slide-${stage}`} role="tabpanel" id={`preview-panel-${stage}`} aria-labelledby={`preview-step-${stage}`} aria-hidden={!present} inert={!present ? true : undefined}
    custom={direction} variants={slideVariants} initial={reduced ? false : 'enter'} animate="center" exit={reduced ? { opacity: 0 } : 'exit'}
    transition={{ duration: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}>{children}</m.div>;
}

export default function LandingPreview({ onStart }) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [direction, setDirection] = useState(1);
  const [priority, setPriority] = useState('value');
  const [selected, setSelected] = useState('civic');
  const locked = useRef(false);
  const unlockTimer = useRef(null);
  const tabs = useRef([]);
  useEffect(() => () => clearTimeout(unlockTimer.current), []);
  function go(next, travel = next > stage ? 1 : -1, focus = false) {
    if (locked.current || next === stage) return;
    locked.current = !reduced;
    setDirection(travel); setStage(next);
    if (focus) tabs.current[next]?.focus();
    // A synchronous lock prevents double-clicks before React renders.
    clearTimeout(unlockTimer.current);
    if (!reduced) unlockTimer.current = setTimeout(() => { locked.current = false; }, 520);
  }
  function onStepKey(event) {
    const next = event.key === 'ArrowRight' ? (stage + 1) % 3 : event.key === 'ArrowLeft' ? (stage + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
    if (next === null) return;
    event.preventDefault(); go(next, event.key === 'ArrowLeft' || event.key === 'Home' ? -1 : 1, true);
  }
  const choice = priorities.find(item => item.id === priority);
  return <aside className="showcase" id="features" aria-label="Interactive, illustrative product preview">
    <div className="showcase-panel">
      <div className="showcase-header"><span className="showcase-brand"><span>d.</span><b>Dilemma<span>.</span></b></span>
        <div className="showcase-steps" role="tablist" aria-label="Preview steps" onKeyDown={onStepKey}>{stages.map((label, index) => <button type="button" role="tab" id={`preview-step-${index}`} aria-controls={`preview-panel-${index}`} aria-selected={stage === index} tabIndex={stage === index ? 0 : -1} ref={el => { tabs.current[index] = el; }} key={label} onClick={() => go(index)}><span>{index + 1}</span>{label}</button>)}</div>
      </div>
      <div className="showcase-window"><AnimatePresence initial={false} custom={direction}><PreviewSlide key={stage} stage={stage} direction={direction} reduced={reduced}>
        {stage === 0 && <div className="showcase-vehicles" aria-label="Four fictional vehicle examples">{cars.map((car, index) => <m.button type="button" className={`preview-vehicle ${selected === car.id ? 'selected' : ''}`} key={car.id} aria-pressed={selected === car.id} aria-label={`Select example ${car.year} ${car.name}`} onClick={() => setSelected(car.id)} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.35, delay: reduced ? 0 : index * 0.04 }}>
          <span className="preview-photo">{photo(car)}</span><strong>{car.year} {car.name}</strong>
          <span className="preview-vehicle-detail"><Icon name="mileage" size={16} />{car.mileage.toLocaleString('en-CA')} km</span><span className="preview-vehicle-detail"><Icon name="transmission" size={16} />{car.transmission}</span><span className="preview-vehicle-detail"><Icon name="location" size={16} />{car.city}</span>
        </m.button>)}</div>}
        {stage === 1 && <div className="showcase-comparison"><h2>A clearer side-by-side.</h2><p className="showcase-kicker">Three fictional contenders. The details that matter.</p>
          <table><caption className="sr-only">Fictional comparison. All prices, mileages and fuel figures are illustrative, not verified specifications.</caption><thead><tr><th scope="col"><span className="sr-only">Detail</span></th>{compared.map(car => <th scope="col" key={car.id}><span className="comparison-photo">{photo(car)}</span><small>{car.year}</small><strong>{car.name}</strong></th>)}</tr></thead><tbody>
            <tr><th scope="row">Price <small>CAD</small></th>{compared.map(car => <td key={car.id} className={car.id === 'mazda3' ? 'example-best' : ''}>{money(car.price)}</td>)}</tr>
            <tr><th scope="row">Mileage</th>{compared.map(car => <td key={car.id}>{car.mileage / 1000}k km</td>)}</tr>
            <tr><th scope="row">Fuel <small>L/100 km</small></th>{compared.map(car => <td key={car.id}>{car.fuel}</td>)}</tr>
            <tr><th scope="row">Gearbox</th>{compared.map(car => <td key={car.id}>{car.transmission === 'Automatic' ? 'Auto' : 'Manual'}</td>)}</tr>
            <tr className="example-highlights"><th scope="row">Highlight</th>{compared.map(car => <td key={car.id}>{car.highlight}</td>)}</tr>
          </tbody></table></div>}
        {stage === 2 && <div className="showcase-decision"><h2>What matters most to you?</h2><div className="sample-priorities" role="group" aria-label="Illustrative decision priority">{priorities.map(item => <button key={item.id} type="button" aria-pressed={priority === item.id} onClick={() => setPriority(item.id)}>{item.label}</button>)}</div>
          <m.div className="preview-match" key={priority} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.2 }} aria-live="polite" aria-atomic="true">
            <div className="match-photo">{photo(choice.car)}<span><Icon name="spark" size={13} /> Example best match</span></div>
            <div className="match-copy"><h3>{choice.car.year} {choice.car.name}</h3><p className="match-reason">{choice.reason}</p><ul>{choice.strengths.map(strength => <li key={strength}><Icon name="check" size={13} />{strength}</li>)}</ul><p className="match-tradeoff"><b>Trade-off</b> {choice.tradeoff}</p></div>
          </m.div></div>}
      </PreviewSlide></AnimatePresence></div>
      <button className="showcase-arrow showcase-previous" type="button" aria-label="Previous preview step" onClick={() => go((stage + 2) % 3, -1)}><Icon name="chevron" size={23} /></button><button className="showcase-arrow showcase-next" type="button" aria-label="Next preview step" onClick={() => go((stage + 1) % 3, 1)}><Icon name="chevron" size={23} /></button>
      <div className="showcase-bottom"><button type="button" className="preview-advance" onClick={() => stage < 2 ? go(stage + 1, 1) : onStart()}>{['Compare These Cars', 'Help Me Decide', 'Try Your Own Cars'][stage]}<Icon name="arrow" size={19} /></button><div className="showcase-progress" role="group" aria-label="Choose preview step">{stages.map((label, index) => <button type="button" key={label} aria-label={`Preview ${label}`} aria-pressed={stage === index} onClick={() => go(index)}><span /></button>)}</div></div>
    </div>
    <p className="showcase-disclaimer">Illustrative preview · Fictional details · Model-example photos <a href="/images/preview/credits.html" target="_blank" rel="noreferrer">Photo credits</a></p>
  </aside>;
}
