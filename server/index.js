import cors from 'cors';
import express from 'express';
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
} from './lib/activitiesRepository.js';
import {
  deleteActivityReport,
  deleteActivityReportDraft,
  getReportsSnapshot,
  upsertActivityReport,
  upsertActivityReportDraft,
} from './lib/reportsRepository.js';
import { pool } from './lib/db.js';
import { loadEnv } from './lib/loadEnv.js';

loadEnv();

const app = express();
const port = Number(process.env.API_PORT || 8787);
const configuredCorsOrigins = process.env.CORS_ORIGIN
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigin = !configuredCorsOrigins || configuredCorsOrigins.length === 0
  ? true
  : (origin, callback) => {
      if (!origin || configuredCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin is not allowed: ${origin}`));
    };

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('select 1');
    response.json({ success: true, status: 'ok' });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Database connection failed.' });
  }
});

app.get('/api/activities', async (_request, response) => {
  try {
    const items = await listActivities();
    response.json({ success: true, items });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Failed to load activities.' });
  }
});

app.post('/api/activities', async (request, response) => {
  try {
    const item = await createActivity(request.body?.activity || {});
    response.status(201).json({ success: true, item });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Failed to create activity.' });
  }
});

app.put('/api/activities/:id', async (request, response) => {
  try {
    const item = await updateActivity(request.params.id, request.body?.activity || {});
    response.json({ success: true, item });
  } catch (error) {
    const status = error.message === 'Activity not found.' ? 404 : 400;
    response.status(status).json({ success: false, error: error.message || 'Failed to update activity.' });
  }
});

app.delete('/api/activities/:id', async (request, response) => {
  try {
    await deleteActivity(request.params.id);
    response.json({ success: true });
  } catch (error) {
    const status = error.message === 'Activity not found.' ? 404 : 400;
    response.status(status).json({ success: false, error: error.message || 'Failed to delete activity.' });
  }
});

app.get('/api/reports', async (_request, response) => {
  try {
    const snapshot = await getReportsSnapshot();
    response.json({ success: true, ...snapshot });
  } catch (error) {
    response.status(500).json({ success: false, error: error.message || 'Failed to load reports.' });
  }
});

app.put('/api/reports/:activityId', async (request, response) => {
  try {
    const item = await upsertActivityReport(request.params.activityId, request.body?.report || {});
    response.json({ success: true, item });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Failed to save report.' });
  }
});

app.delete('/api/reports/:activityId', async (request, response) => {
  try {
    await deleteActivityReport(request.params.activityId);
    response.json({ success: true });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Failed to delete report.' });
  }
});

app.put('/api/report-drafts/:activityId', async (request, response) => {
  try {
    const item = await upsertActivityReportDraft(request.params.activityId, request.body?.draft || {});
    response.json({ success: true, item });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Failed to save report draft.' });
  }
});

app.delete('/api/report-drafts/:activityId', async (request, response) => {
  try {
    await deleteActivityReportDraft(request.params.activityId);
    response.json({ success: true });
  } catch (error) {
    response.status(400).json({ success: false, error: error.message || 'Failed to delete report draft.' });
  }
});

app.listen(port, () => {
  console.log(`PostgreSQL API listening on http://localhost:${port}`);
});