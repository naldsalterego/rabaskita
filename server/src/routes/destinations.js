import { Router } from 'express';
import { query } from '../db.js';
const r = Router();
r.get('/', async (req, res) => {
  const { municipality, category, q } = req.query;
  const { rows } = await query(
    `SELECT d.id,d.name,d.description,d.photos,d.lat,d.lng,d.travel_minutes_from_virac,m.name AS municipality,t.points
     FROM destinations d JOIN municipalities m ON m.id=d.municipality_id LEFT JOIN point_tiers t ON t.id=d.point_tier_id
     WHERE d.is_published AND ($1::text IS NULL OR m.name=$1) AND ($2::int IS NULL OR d.category_id=$2) AND ($3::text IS NULL OR d.name ILIKE '%'||$3||'%')
     ORDER BY d.name LIMIT 100`, [municipality || null, category ? Number(category) : null, q || null]);
  res.json(rows);
});
r.get('/:id', async (req, res) => {
  const { rows } = await query('SELECT d.*,m.name AS municipality,t.points FROM destinations d JOIN municipalities m ON m.id=d.municipality_id LEFT JOIN point_tiers t ON t.id=d.point_tier_id WHERE d.id=$1 AND d.is_published', [req.params.id]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Destination not found' });
});
export default r;
