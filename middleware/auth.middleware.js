import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';

export const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.role === 'doctor') {
                req.user = await Doctor.findById(decoded.id).select('-password');
                console.log(`Auth: Found doctor ${decoded.id}: ${req.user ? 'yes' : 'no'}`);
            } else {
                req.user = await User.findById(decoded.id).select('-password');
                console.log(`Auth: Found user ${decoded.id}: ${req.user ? 'yes' : 'no'}`);
            }

            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
            }

            // attach role to request for role checking later
            req.user.role = decoded.role;

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};
