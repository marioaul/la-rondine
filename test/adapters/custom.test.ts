import { describe, expect, it } from 'vitest';
import { parseHtmlEvents } from '../../src/adapters/custom';

const baseSrc = {
  source_url: 'https://example.com',
  url: null,
  source_type: 'html',
  provincia: null,
  provincia_override: 'Napoli',
  categoria_override: null,
  quality_override: 6,
};

describe('parseHtmlEvents', () => {
  it('estrae un evento da un blocco ld+json valido', () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {
        "@type": "MusicEvent",
        "name": "Concerto in piazza",
        "startDate": "2026-09-15T20:00:00",
        "description": "Una serata di musica",
        "location": { "name": "Piazza Plebiscito", "address": { "addressLocality": "Napoli" } },
        "url": "https://example.com/evento"
      }
      </script>
      </head></html>`;
    const result = parseHtmlEvents(html, 'https://example.com', baseSrc);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Concerto in piazza');
    expect(result[0]?.eventDate).toBe('2026-09-15');
    expect(result[0]?.provincia).toBe('Napoli');
  });

  it('ignora blocchi ld+json di tipo diverso da Event', () => {
    const html = `
      <script type="application/ld+json">
      { "@type": "Organization", "name": "Non è un evento" }
      </script>`;
    expect(parseHtmlEvents(html, 'https://example.com', baseSrc)).toHaveLength(0);
  });

  it('ignora blocchi ld+json malformati senza lanciare eccezioni', () => {
    const html = `<script type="application/ld+json">{ questo non è json valido </script>`;
    expect(() => parseHtmlEvents(html, 'https://example.com', baseSrc)).not.toThrow();
    expect(parseHtmlEvents(html, 'https://example.com', baseSrc)).toHaveLength(0);
  });

  it('gestisce più eventi dentro un array @graph', () => {
    const html = `
      <script type="application/ld+json">
      { "@graph": [
        { "@type": "Event", "name": "Evento uno", "startDate": "2026-08-01" },
        { "@type": "Event", "name": "Evento due", "startDate": "2026-08-02" }
      ]}
      </script>`;
    const result = parseHtmlEvents(html, 'https://example.com', baseSrc);
    expect(result).toHaveLength(2);
  });

  it('scarta eventi senza titolo o senza data', () => {
    const html = `
      <script type="application/ld+json">
      { "@type": "Event", "name": "", "startDate": "2026-08-01" }
      </script>`;
    expect(parseHtmlEvents(html, 'https://example.com', baseSrc)).toHaveLength(0);
  });
});
