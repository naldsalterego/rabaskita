import jwt from 'jsonwebtoken';
export const sign = (u) => jwt.sign({ sub: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
export function requireAuth(...roles) {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    try {
      const p = jwt.verify(token, process.env.JWT_SECRET);
      if (roles.length && !roles.includes(p.role)) return res.status(403).json({ error: 'Forbidden' });
      req.user = { id: p.sub, role: p.role };
      next();
    } catch { res.status(401).json({ error: 'Sign in required' }); }
  };
}
