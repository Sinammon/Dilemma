import React, { useState } from 'react';

// A component is a function that returns a piece of the page.
export default function App() {
  const [message, setMessage] = useState('');

  function handleSubmit(event) {
    event.preventDefault(); // Keep the browser from reloading the page.
    setMessage('You found the starting line! Listing import is coming later. No data was sent.');
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="Dilemma home">
          <span className="brand-mark" aria-hidden="true">d.</span>
          dilemma<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">The idea</a>
          <a className="nav-button" href="#get-started">Get started <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span aria-hidden="true" /> A clearer road to your next car</p>
            <h1 id="hero-title">Stop searching.<br /><span>Start deciding.</span></h1>
            <p className="hero-description">Too many tabs. Too many maybes. Dilemma is a starting point for making sense of used-car listings, so you can find a car that fits your life.</p>

            <form id="get-started" className="url-form" onSubmit={handleSubmit}>
              <label htmlFor="listing-url">Have a car in mind? Start with a link.</label>
              <div className="input-row">
                <input id="listing-url" name="listingUrl" type="url" placeholder="https://www.ebay.ca/itm/..." required aria-describedby="input-note" />
                <button type="submit">Try it out <span aria-hidden="true">→</span></button>
              </div>
              <p id="input-note" className="input-note">Homepage demo · Listing import isn’t connected yet.</p>
              <p className="form-message" role="status">{message}</p>
            </form>
          </div>

          <div className="hero-art" role="img" aria-label="Illustration of a blue car on a winding road, with the words Your next chapter">
            <div className="art-topline"><span>LESS GUESSWORK</span><span aria-hidden="true">↗</span></div>
            <p className="art-heading">Your next<br /><em>chapter.</em></p>
            <svg className="car-scene" viewBox="0 0 520 310" aria-hidden="true">
              <ellipse cx="268" cy="267" rx="199" ry="22" fill="#bdcbed" />
              <path d="M-20 310 Q130 175 250 274 T560 245" fill="none" stroke="#fff" strokeWidth="42" opacity=".65" />
              <path d="M-20 310 Q130 175 250 274 T560 245" fill="none" stroke="#a3b5dd" strokeWidth="2" strokeDasharray="12 14" />
              <path d="M84 194 132 126 Q142 112 161 112 H305 Q326 112 344 133 L394 180 439 196 Q450 200 450 215 V243 H67 V215 Q67 199 84 194Z" fill="#2458e6" />
              <path d="m148 132-36 53h107v-53Z" fill="#dcecff" />
              <path d="M232 132v53h135l-50-47q-6-6-16-6Z" fill="#dcecff" />
              <path d="m241 137 40 42h-40ZM172 137l-32 42h-17l31-42Z" fill="#fff" opacity=".6" />
              <path d="M76 211h31M412 211h28" stroke="#e1efff" strokeWidth="9" strokeLinecap="round" />
              <path d="M182 202h20m58 0h20" stroke="#173caa" strokeWidth="5" strokeLinecap="round" />
              <path d="M193 231h126" stroke="#497af1" strokeWidth="4" />
              <circle cx="143" cy="241" r="34" fill="#172e57" /><circle cx="143" cy="241" r="17" fill="#e0e9fa" /><circle cx="143" cy="241" r="7" fill="#8da7d4" />
              <circle cx="369" cy="241" r="34" fill="#172e57" /><circle cx="369" cy="241" r="17" fill="#e0e9fa" /><circle cx="369" cy="241" r="7" fill="#8da7d4" />
            </svg>
            <div className="art-bottomline"><span>A little clarity. A lot of possibility.</span><span aria-hidden="true">✦</span></div>
          </div>
        </section>

        <section id="how-it-works" className="idea-section" aria-labelledby="idea-title">
          <div><p className="eyebrow">THE IDEA BEHIND DILEMMA</p><h2 id="idea-title">A big decision.<br />A simpler beginning.</h2></div>
          <p>Finding a used car can feel like a hundred open tabs and no clear answer. The idea is simple: start with a listing, bring the details into focus, and make your next move with more clarity.</p>
        </section>
      </main>

      <footer><a className="footer-brand" href="#">dilemma.</a><span>Made for the road ahead.</span><span className="prototype-label">An early prototype</span></footer>
    </div>
  );
}
