import React, { useEffect, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import Icon from './Icons.jsx';

// Illustrative data stays separate from imported listings and the decision engine.
const samples = [
  { name: 'Honda Civic', year: '2018', trim: 'EX · Automatic', price: 16900, mileage: 82000, city: 'Toronto, ON', color: 'silver' },
  { name: 'Toyota Corolla', year: '2019', trim: 'LE · Automatic', price: 18400, mileage: 67000, city: 'Mississauga, ON', color: 'blue' },
  { name: 'Mazda3', year: '2017', trim: 'GS · Manual', price: 14500, mileage: 90000, city: 'Ottawa, ON', color: 'navy' },
];
const money = value => `$${value.toLocaleString('en-CA')}`;
const stages = ['Import', 'Compare', 'Decide'];

export default function LandingPreview({ onStart }) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [priority, setPriority] = useState('price');
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (reduced || paused || hovered || focused || !visible || stage !== 0) return;
    const timer = setInterval(() => setActive(index => (index + 1) % samples.length), 5500);
    return () => clearInterval(timer);
  }, [reduced, paused, hovered, focused, visible, stage]);
  const winner = [...samples].sort((a, b) => priority === 'year' ? Number(b.year) - Number(a.year) : a[priority] - b[priority])[0];
  const duration = reduced ? 0 : 0.55;
  return <aside className="preview-wrap" aria-label="Interactive sample comparison">
    <div className="preview-caption"><span className="preview-caption-line" /> A little less guesswork.<span className="sample-badge">Interactive preview</span></div>
    <div className="product-preview" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="preview-top"><span className="preview-brand"><span className="mini-mark">d.</span> Your shortlist</span><span className="preview-live"><span /> 3 sample cars</span></div>
      <div className="preview-stages" role="group" aria-label="Preview stage">{stages.map((label, index) => <button type="button" key={label} className={stage === index ? 'active' : ''} aria-pressed={stage === index} onClick={() => setStage(index)}><span>{index < stage ? <Icon name="check" size={12} /> : index + 1}</span>{label}</button>)}</div>
      <div className="preview-body">
        <m.div key={stage} initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.28 }}>
          <div className="preview-section-heading"><h2>{['Meet your contenders.', 'The facts. Side by side.', 'Your priorities. Your pick.'][stage]}</h2><span>0{stage + 1} / 03</span></div>
          {stage === 0 && <>
            <div className="sample-carousel" aria-roledescription="carousel" aria-label="Sample vehicles">
              <div className="sample-viewport">
                <m.div className="sample-track" animate={{ x: `-${active * 100}%` }} transition={{ duration, ease: [0.22, 1, 0.36, 1] }}>
                  {samples.map((car, index) => <article className="sample-car" key={car.name} aria-hidden={index !== active} aria-roledescription="slide" aria-label={`${index + 1} of 3: ${car.name}`} inert={index !== active ? true : undefined}>
                    <div className="sample-car-top"><span className={`sample-monogram ${car.color}`}>{car.name === 'Mazda3' ? 'M' : car.name.slice(0, 1)}<span>{car.year.slice(2)}</span></span><span className="imported-pill"><Icon name="check" size={12} /> Ready to compare</span></div>
                    <p className="sample-year">{car.year} · {car.trim}</p><h3>{car.name}</h3><p className="sample-price">{money(car.price)} <span>CAD</span></p>
                    <div className="sample-specs"><div><span>Mileage</span><strong>{car.mileage.toLocaleString('en-CA')} km</strong></div><div><span>Location</span><strong>{car.city}</strong></div></div>
                  </article>)}
                </m.div>
              </div>
              <div className="carousel-controls"><div className="carousel-dots" role="group" aria-label="Choose sample vehicle">{samples.map((car, index) => <button type="button" key={car.name} className={active === index ? 'active' : ''} aria-label={`Show ${car.year} ${car.name}`} aria-pressed={active === index} onClick={() => { setActive(index); setPaused(true); }}><span /></button>)}</div><span className="carousel-position">{String(active + 1).padStart(2, '0')} <span>/ 03</span></span><button type="button" className="carousel-toggle" aria-label={paused || reduced ? 'Play sample carousel' : 'Pause sample carousel'} disabled={!!reduced} onClick={() => setPaused(value => !value)}><Icon name={paused || reduced ? 'play' : 'pause'} size={14} /></button><button type="button" className="carousel-next" aria-label="Next sample vehicle" onClick={() => { setActive(index => (index + 1) % samples.length); setPaused(true); }}><Icon name="chevron" size={16} /></button></div>
            </div>
          </>}
          {stage === 1 && <div className="preview-comparison"><div className="preview-table-scroll"><table><caption className="sr-only">Illustrative comparison of three sample vehicles</caption><thead><tr><th scope="col">Details</th>{samples.map(car => <th scope="col" key={car.name}>{car.name}</th>)}</tr></thead><tbody><tr><th scope="row">Year</th>{samples.map(car => <td key={car.name}>{car.year}</td>)}</tr><tr><th scope="row">Price · CAD</th>{samples.map(car => <td key={car.name} className={car.price === 14500 ? 'sample-best' : ''}>{money(car.price)}</td>)}</tr><tr><th scope="row">Mileage</th>{samples.map(car => <td key={car.name} className={car.mileage === 67000 ? 'sample-best' : ''}>{car.mileage / 1000}k km</td>)}</tr><tr><th scope="row">Gearbox</th>{samples.map(car => <td key={car.name}>{car.trim.split(' · ')[1] === 'Manual' ? 'Manual' : 'Auto'}</td>)}</tr></tbody></table></div><p className="preview-insight"><Icon name="compare" size={16} /> Lower price or lower mileage? See the trade-offs.</p></div>}
          {stage === 2 && <div className="preview-decision"><div className="sample-priorities" role="group" aria-label="Sample decision priority">{[['price', 'Lowest price'], ['mileage', 'Less mileage'], ['year', 'Newer year']].map(([id, label]) => <button type="button" key={id} aria-pressed={priority === id} className={priority === id ? 'active' : ''} onClick={() => setPriority(id)}>{label}</button>)}</div><m.div key={priority} initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.25 }} className="sample-match" aria-live="polite"><span className="match-icon"><Icon name="spark" size={22} /></span><p className="sample-match-label">{priority === 'price' ? 'LOWEST SAMPLE PRICE' : priority === 'mileage' ? 'LOWEST SAMPLE MILEAGE' : 'NEWEST SAMPLE YEAR'}</p><h3>{winner.year} {winner.name}</h3><p>{money(winner.price)} CAD <span>·</span> {winner.mileage.toLocaleString('en-CA')} km</p><span className="sample-match-reason">{priority === 'price' ? 'More room in your budget.' : priority === 'mileage' ? 'Fewer kilometres on the clock.' : 'The most recent model year.'}</span></m.div></div>}
        </m.div>
      </div>
      <div className="preview-bottom"><span><Icon name="shield" size={14} /> Sample data, real possibilities.</span><button type="button" className="preview-advance" onClick={() => stage < 2 ? setStage(stage + 1) : onStart()}>{['Compare cars', 'Find my pick', 'Try your own'][stage]}<Icon name="arrow" size={15} /></button></div>
    </div>
    <p className="preview-disclaimer">Just a preview. Your comparison starts with your own eBay.ca links.</p>
  </aside>;
}
