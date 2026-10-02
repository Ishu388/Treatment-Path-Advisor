import React, { useContext, useEffect, useState } from 'react';
import { Upload, File, Trash2, Download } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { LanguageContext } from '../i18n/LanguageContext';

export default function DocumentVault() {
  const { user } = useContext(AuthContext);
  const { t } = useContext(LanguageContext);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/documents/${user.username}`);
      if (res.ok) {
        setDocuments(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('username', user.username);
    formData.append('category', 'General');
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        fetchDocuments();
      } else {
        alert(t('documents.uploadFailed') + ' ' + (await res.json()).detail);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('documents.confirmDelete'))) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) fetchDocuments();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page-container">
      <header className="page-header" style={{ marginBottom: '30px' }}>
        <h1>{t('documents.title')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>{t('documents.subtitle')}</p>
      </header>
      
      <div className="card" style={{ marginBottom: '30px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h3>{t('documents.uploadTitle')}</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('documents.formats')}</p>
        </div>
        <label className="btn-primary" style={{ cursor: 'pointer' }}>
          <Upload size={20} /> {loading ? t('documents.uploading') : t('documents.uploadBtn')}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleUpload} disabled={loading} />
        </label>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>{t('documents.yourDocs')}</h3>
        {documents.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>{t('documents.noDocs')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {documents.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <File size={24} color="var(--primary)" />
                  <div>
                    <strong style={{ display: 'block' }}>{doc.filename}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(doc.created_at).toLocaleDateString()} • {doc.category} • {doc.file_size}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="icon-btn" title={t('common.delete')} style={{ color: 'var(--danger)' }} onClick={() => handleDelete(doc.id)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
