import { useEffect, useMemo, useState } from 'react';
import type { TranscriptResult } from '@/utils/transcript';
import { formatTimestamp, formatTranscript } from '@/utils/transcript';
import './App.css';

type PopupStatus = 'idle' | 'loading' | 'ready' | 'error';

type TranscriptState = {
  status: PopupStatus;
  videoId: string | null;
  result: TranscriptResult | null;
  error: string | null;
};

type ExtractResponse =
  | {
      ok: true;
      data: TranscriptResult;
    }
  | {
      ok: false;
      error: string;
    };

type StateResponse =
  | {
      ok: true;
      state: TranscriptState;
    }
  | {
      ok: false;
      error: string;
    };

function App() {
  const [status, setStatus] = useState<PopupStatus>('idle');
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const transcriptText = useMemo(() => {
    return result ? formatTranscript(result.cues) : '';
  }, [result]);

  useEffect(() => {
    void readCurrentState();
  }, []);

  async function readCurrentState(): Promise<void> {
    try {
      const response = (await sendToActiveTab({
        type: 'SOCRATES_GET_TRANSCRIPT_STATE',
      })) as StateResponse;

      if (!response.ok) {
        setStatus('idle');
        return;
      }

      setStatus(response.state.status);
      setResult(response.state.result);
      setError(response.state.error);
    } catch {
      setStatus('idle');
      setResult(null);
      setError('No active YouTube video tab.');
    }
  }

  async function extractTranscript(force = false): Promise<void> {
    setStatus('loading');
    setError(null);
    setCopied(false);

    try {
      const response = (await sendToActiveTab({
        type: 'SOCRATES_EXTRACT_TRANSCRIPT',
        force,
      })) as ExtractResponse;

      if (!response.ok) {
        throw new Error(response.error);
      }

      setResult(response.data);
      setStatus('ready');
    } catch (caughtError) {
      setStatus('error');
      setResult(null);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Transcript extraction failed.',
      );
    }
  }

  async function copyTranscript(): Promise<void> {
    if (!transcriptText) return;
    await navigator.clipboard.writeText(transcriptText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const duration = result?.cues.at(-1)?.end ?? 0;

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <p className="eyebrow">Socrates</p>
          <h1>YouTube transcript</h1>
        </div>
        <span className={`status-dot status-dot--${status}`} aria-label={status} />
      </header>

      <section className="summary">
        <p className="summary-title">{readSummaryTitle(status, result, error)}</p>
        <p className="summary-detail">
          {result
            ? `${result.cues.length} lines - ${result.segments.length} chunks - ${formatTimestamp(
                duration,
              )}`
            : 'Waiting for active video.'}
        </p>
      </section>

      <div className="actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => void extractTranscript(Boolean(result))}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Extracting...' : result ? 'Refresh' : 'Extract'}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => void copyTranscript()}
          disabled={!result}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <textarea
        className="transcript"
        value={transcriptText}
        readOnly
        spellCheck={false}
        placeholder="Transcript"
      />
    </main>
  );
}

async function sendToActiveTab(message: unknown): Promise<unknown> {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    throw new Error('No active browser tab found.');
  }

  return browser.tabs.sendMessage(tab.id, message);
}

function readSummaryTitle(
  status: PopupStatus,
  result: TranscriptResult | null,
  error: string | null,
): string {
  if (status === 'loading') return 'Reading YouTube captions...';
  if (status === 'ready' && result) return result.title;
  if (status === 'error') return error ?? 'Unable to extract transcript.';
  return 'No transcript loaded.';
}

export default App;
