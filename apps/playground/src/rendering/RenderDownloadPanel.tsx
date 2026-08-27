import { useEffect, useState } from 'react';
import { type CatalogueView, downloadPdf, fetchCatalogue, RenderRefusal } from './client.js';

/**
 * Component for selecting templates/datasets and triggering PDF download via dev bridge.
 */

const panelStyle = {
  border: '1px solid #1b3a6f',
  borderRadius: '4px',
  padding: '1rem',
  marginBottom: '1.5rem',
} as const;

const rowStyle = {
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'flex-end',
  flexWrap: 'wrap',
} as const;
const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '0.25rem' } as const;
const refusalStyle = { color: '#8C3A1B', marginTop: '0.75rem' } as const;
const doneStyle = { color: '#1b3a6f', marginTop: '0.75rem' } as const;

export function RenderDownloadPanel() {
  const [catalogue, setCatalogue] = useState<CatalogueView | undefined>(undefined);
  const [templateId, setTemplateId] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const [done, setDone] = useState<string | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void fetchCatalogue()
      .then((view) => {
        if (!live) {
          return;
        }
        setCatalogue(view);
        setTemplateId(view.templates[0]?.id ?? '');
        setDatasetId(view.datasets[0]?.id ?? '');
      })
      .catch((error: unknown) => {
        if (live) {
          setRefusal(
            error instanceof RenderRefusal
              ? error.message
              : 'The local render bridge is not running. It exists under `pnpm dev` only.',
          );
        }
      });
    return () => {
      live = false;
    };
  }, []);

  const run = (): void => {
    setBusy(true);
    setRefusal(undefined);
    setDone(undefined);
    void downloadPdf(templateId, datasetId)
      .then((filename) => {
        setDone(filename);
      })
      .catch((error: unknown) => {
        setRefusal(
          error instanceof RenderRefusal
            ? `${error.code} — ${error.message}`
            : 'The render failed before the bridge answered.',
        );
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const ready = catalogue !== undefined && templateId !== '' && datasetId !== '';

  return (
    <section style={panelStyle}>
      <h2>Télécharger le PDF</h2>
      <p>
        Le rendu s'exécute côté serveur — un navigateur ne lance pas Chromium. Les deux routes
        n'existent que sous <code>pnpm dev</code> et n'acceptent que les identifiants ci-dessous.
      </p>
      <div style={rowStyle}>
        <label style={fieldStyle}>
          <span>Modèle</span>
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            disabled={catalogue === undefined}
          >
            {(catalogue?.templates ?? []).map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          <span>Jeu de données</span>
          <select
            value={datasetId}
            onChange={(event) => setDatasetId(event.target.value)}
            disabled={catalogue === undefined}
          >
            {(catalogue?.datasets ?? []).map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={run} disabled={!ready || busy}>
          {busy ? 'Rendu en cours…' : 'Télécharger'}
        </button>
      </div>
      {refusal === undefined ? undefined : <p style={refusalStyle}>{refusal}</p>}
      {done === undefined ? undefined : <p style={doneStyle}>Téléchargé : {done}</p>}
    </section>
  );
}
