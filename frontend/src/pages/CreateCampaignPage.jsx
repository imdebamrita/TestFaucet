import React, { useState } from 'react';
import { createCampaign } from '../lib/contract.js';
import './CreateCampaignPage.css';

export default function CreateCampaignPage({ publicKey, onSuccess, onToast }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    goal: '100',
    days: '30',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!publicKey) return;
    setSubmitting(true);
    const tid = onToast('Creating your campaign…', 'loading');

    try {
      const goalNum = parseFloat(form.goal);
      const deadline = Math.floor(Date.now() / 1000) + parseInt(form.days) * 86400;
      await createCampaign(publicKey, form.title, form.description, goalNum, deadline);
      onToast('Campaign launched successfully! 🚀', 'success', tid);
      onSuccess();
    } catch (err) {
      console.error('Create campaign failed:', err);
      onToast(err.message || 'Failed to create campaign', 'error', tid);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = form.title.trim() && form.description.trim() && parseFloat(form.goal) > 0 && parseInt(form.days) > 0;

  return (
    <div className="create-page animate-fade-in">
      <div className="create-header">
        <h1>Launch a <span className="gradient-text">Campaign</span></h1>
        <p className="create-subtitle">
          Set your goal, define a timeline, and share your vision with backers around the world.
        </p>
      </div>

      <div className="create-card glass-card">
        <form onSubmit={handleSubmit} className="create-form">
          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="create-title">
              Project Title
            </label>
            <input
              id="create-title"
              name="title"
              className="input-field"
              type="text"
              required
              placeholder="e.g., Decentralized Weather Station Network"
              value={form.title}
              onChange={handleChange}
              maxLength={80}
            />
            <span className="form-hint">{form.title.length}/80 characters</span>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="create-description">
              Description
            </label>
            <textarea
              id="create-description"
              name="description"
              className="input-field input-field--textarea"
              required
              placeholder="Describe your project, what you're building, and why backers should support it…"
              value={form.description}
              onChange={handleChange}
            />
          </div>

          {/* Goal + Duration */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="create-goal">
                Funding Goal (tokens)
              </label>
              <input
                id="create-goal"
                name="goal"
                className="input-field"
                type="number"
                min="1"
                step="any"
                required
                value={form.goal}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="create-days">
                Duration (days)
              </label>
              <input
                id="create-days"
                name="days"
                className="input-field"
                type="number"
                min="1"
                max="365"
                required
                value={form.days}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Duration presets */}
          <div className="duration-presets">
            {[7, 14, 30, 60, 90].map((d) => (
              <button
                key={d}
                type="button"
                className={`preset-chip ${form.days === String(d) ? 'preset-chip--active' : ''}`}
                onClick={() => setForm({ ...form, days: String(d) })}
              >
                {d} days
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="create-preview">
            <h4 className="preview-label">Campaign Preview</h4>
            <div className="preview-grid">
              <div className="preview-item">
                <span className="preview-item-label">Goal</span>
                <span className="preview-item-value">{parseFloat(form.goal) || 0} tokens</span>
              </div>
              <div className="preview-item">
                <span className="preview-item-label">Deadline</span>
                <span className="preview-item-value">
                  {new Date(Date.now() + parseInt(form.days || 0) * 86400000).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            className="btn btn-primary btn-lg create-submit"
            type="submit"
            disabled={submitting || !isValid}
            id="btn-create-campaign"
          >
            {submitting ? (
              <><span className="spinner" /> Creating…</>
            ) : (
              '🚀 Launch Campaign'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
