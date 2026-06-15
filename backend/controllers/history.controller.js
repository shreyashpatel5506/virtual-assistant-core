import History from '../models/history.model.js';

export const storehistory = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { action, timestamp } = req.body;

        if (!userId) {
            return res.status(401).json({
                message: 'Unauthorized access',
                success: false,
            });
        }

        if (!action || !action.trim()) {
            return res.status(400).json({
                message: 'Action is required',
                success: false,
            });
        }

        const history = await History.create({
            userId,
            action: action.trim(),
            timestamp: timestamp || Date.now(),
        });

        return res.status(201).json({
            message: 'History stored successfully',
            success: true,
            history,
        });
    } catch (error) {
        console.error('Error storing history:', error);
        return res.status(500).json({
            message: 'Internal server error',
            success: false,
        });
    }
};

export const retrievehistory = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                message: 'Unauthorized access',
                success: false,
            });
        }

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const search = req.query.search?.trim();

        const query = { userId };

        if (search) {
            query.action = { $regex: search, $options: 'i' };
        }

        const [histories, total] = await Promise.all([
            History.find(query)
                .sort({ timestamp: -1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            History.countDocuments(query),
        ]);

        return res.status(200).json({
            message: 'History retrieved successfully',
            success: true,
            histories,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error retrieving history:', error);
        return res.status(500).json({
            message: 'Internal server error',
            success: false,
        });
    }
};