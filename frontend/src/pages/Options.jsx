import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import useFeedback from '../hooks/useFeedback';
import Loading from '../components/Loading';
import OrgSettingsForm from '../components/OrgSettingsForm';
import PageHeader from '../components/PageHeader';
import OrgSwitcher from '../components/OrgSwitcher';

// Quiet time after the last edit before saving.
const SAVE_DELAY_MS = 800;

const STATUS = {
  saved: { text: 'All changes saved', className: 'text-ink/45' },
  saving: { text: 'Saving…', className: 'text-ink/45' },
  incomplete: { text: 'Name the empty rows to save', className: 'text-warning' },
  error: { text: 'Not saved', className: 'text-danger' },
};

export default function Options() {
  const [orgName, setOrgName] = useState('');
  const [initial, setInitial] = useState(null);
  const [memberCounts, setMemberCounts] = useState(null);
  const [status, setStatus] = useState('saved');
  const { notify } = useFeedback();
  const formRef = useRef(null);
  const timer = useRef(null);
  const saving = useRef(false);
  const saveAgain = useRef(false);
  // The values as of the last edit, for the save that runs after the form is gone.
  const lastValues = useRef(null);
  // Read by the delayed save, which would otherwise see the value of an older render.
  const orgNameRef = useRef(orgName);
  orgNameRef.current = orgName;

  useEffect(() => {
    api
      .get('/options')
      .then((res) => {
        setOrgName(res.data?.org_name || '');
        setInitial(res.data || {});
      })
      .catch((error) => console.error(error));

    api
      .get('/members')
      .then((res) => {
        const counts = {};
        (res.data || []).forEach((m) => {
          const cat = m.categories?.[0];
          if (m.resigned || !cat) return;
          counts[cat] = (counts[cat] || 0) + 1;
        });
        setMemberCounts(counts);
      })
      .catch(() => {});
  }, []);

  const save = async (result = formRef.current?.getValues({ allowEmptyRows: false })) => {
    timer.current = null;
    if (saving.current) {
      saveAgain.current = true;
      return;
    }
    if (!result) return setStatus('error');
    if (result.incomplete) return setStatus('incomplete');

    saving.current = true;
    setStatus('saving');
    const name = orgNameRef.current.trim();
    try {
      // Before the options, so members and assignments follow the rename.
      for (const r of result.renames) {
        await api.post('/categories/rename', { old_name: r._orig.trim(), new_name: r.name.trim() });
      }
      await api.post('/options', { org_name: name, ...result.payload });
      result.applySaved();
      setInitial((prev) => ({ ...prev, org_name: name, ...result.payload }));
      setStatus('saved');
    } catch (error) {
      console.error(error);
      setStatus('error');
      notify(error.response?.data?.detail || 'Could not save the options.', 'error');
    } finally {
      saving.current = false;
      if (saveAgain.current) {
        saveAgain.current = false;
        save();
      }
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  const scheduleSave = () => {
    lastValues.current = formRef.current?.getValues({ allowEmptyRows: false });
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveRef.current(), SAVE_DELAY_MS);
  };

  useEffect(() => {
    if (initial && orgName !== (initial.org_name || '')) scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgName]);

  // Leaving the page still saves what was typed last.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        saveRef.current(lastValues.current);
      }
    },
    [],
  );

  if (!initial) {
    return <Loading />;
  }

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader title="Options" subtitle="Organization settings">
        <span
          className={`font-mono text-label font-bold uppercase tracking-wide ${STATUS[status].className}`}
        >
          {STATUS[status].text}
        </span>
        <OrgSwitcher />
      </PageHeader>

      <main className="flex-1 bg-surface pb-24 sm:pb-0">
        <OrgSettingsForm
          ref={formRef}
          variant="banded"
          initial={initial}
          memberCounts={memberCounts}
          onDirtyChange={(dirty) => dirty && scheduleSave()}
          orgName={orgName}
          onOrgNameChange={setOrgName}
        />
      </main>
    </div>
  );
}
