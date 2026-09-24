import { useCallback, useEffect, useRef, useState } from 'react';
import { TaskList, type Tab } from './screens/TaskList';
import { TaskDetail, type Details } from './screens/TaskDetail';
import { Toast } from './components/Toast';
import { labels } from './labels';
import { config } from './config';
import { currentCompliments, findCompliment, refreshCompliments } from './compliments';
import { enqueue, flushQueue, getQueue, newId, startAutoRetry, subscribeQueue } from './queue';
import { getLocationForEntry, warmLocation } from './geo';
import { localIsoTimestamp } from './time';
import { readJson, writeJson } from './storage';
import type { Entry } from './api';

type Screen = 'list' | 'detail';
const emptyDetails: Details = { gender: null, race: null, age: null };

export function App() {
  const [screen, setScreen] = useState<Screen>('list');
  const [tab, setTab] = useState<Tab>(() => readJson<Tab>('tab', 'frequent'));
  const [compliments, setCompliments] = useState(currentCompliments);
  const [pending, setPending] = useState(() => getQueue().length);
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const reloadList = useCallback(() => setCompliments(currentCompliments()), []);

  const syncList = useCallback(() => {
    void refreshCompliments().then((ok) => ok && reloadList());
  }, [reloadList]);

  // Startup: location prompt, persistent storage, queue retries, list refresh.
  useEffect(() => {
    warmLocation();
    void navigator.storage?.persist?.().catch(() => undefined);
    const unsubscribe = subscribeQueue(() => {
      setPending(getQueue().length);
      reloadList();
    });
    const stopRetry = startAutoRetry(syncList);
    syncList();
    window.addEventListener('online', syncList);
    return () => {
      unsubscribe();
      stopRetry();
      window.removeEventListener('online', syncList);
    };
  }, [reloadList, syncList]);

  // Browser/Android back button returns from details to the list.
  useEffect(() => {
    if (history.state?.screen === 'detail') history.replaceState(null, '');
    const onPop = () => setScreen(history.state?.screen === 'detail' ? 'detail' : 'list');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), config.toastMs);
  };

  const changeTab = (t: Tab) => {
    setTab(t);
    writeJson('tab', t);
  };

  const addCompliment = (name: string) => {
    const existing = findCompliment(compliments, name);
    if (existing) {
      setSelected(existing.name);
      return;
    }
    enqueue({ id: newId(), action: 'addCompliment', name });
    setSelected(name);
    void flushQueue();
  };

  const goNext = () => {
    if (!selected) return;
    warmLocation();
    history.pushState({ screen: 'detail' }, '');
    setScreen('detail');
  };

  const goBack = () => {
    if (history.state?.screen === 'detail') history.back();
    else setScreen('list');
  };

  const submit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    const timestamp = localIsoTimestamp();
    const coords = await getLocationForEntry();
    const entry: Entry = {
      id: newId(),
      timestamp,
      latitude: coords?.lat ?? '',
      longitude: coords?.lng ?? '',
      compliment: selected,
      gender: details.gender ?? '',
      race: details.race ?? '',
      ageRange: details.age ?? '',
    };
    const saved = enqueue({ id: entry.id, action: 'addEntry', entry });
    setSubmitting(false);
    if (!saved) {
      showToast(labels.saveFailed);
      return;
    }
    setSelected(null);
    setDetails(emptyDetails);
    goBack();
    showToast(labels.saved);
    void flushQueue().then((n) => n > 0 && syncList());
  };

  return (
    <>
      {screen === 'list' ? (
        <TaskList
          compliments={compliments}
          tab={tab}
          onTab={changeTab}
          selected={selected}
          onSelect={setSelected}
          onAdd={addCompliment}
          onNext={goNext}
          pending={pending}
        />
      ) : (
        <TaskDetail
          task={selected ?? ''}
          details={details}
          onChange={setDetails}
          onBack={goBack}
          onSubmit={submit}
          submitting={submitting}
        />
      )}
      <Toast message={toast} />
    </>
  );
}
