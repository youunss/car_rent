const Car = require('../models/Car'); // Should exist
const { successResponse, errorResponse } = require('../utils/apiResponse'); // Should exist

// Display list of available cars (API)
exports.listAvailableCars = async (req, res, next) => {
    try {
        let query = { status: 'available' };
        const queryParamsForResponse = {}; // To send back applied filters if any

        // Text search for make or model
        if (req.query.search && req.query.search.trim() !== '') {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            query.$or = [{ make: searchRegex }, { model: searchRegex }];
            queryParamsForResponse.search = req.query.search.trim();
        }

        // Price range filter
        if (req.query.minPrice && !isNaN(parseFloat(req.query.minPrice))) {
            if (!query.pricePerDay) query.pricePerDay = {};
            query.pricePerDay.$gte = parseFloat(req.query.minPrice);
            queryParamsForResponse.minPrice = req.query.minPrice;
        }
        if (req.query.maxPrice && !isNaN(parseFloat(req.query.maxPrice))) {
            if (!query.pricePerDay) query.pricePerDay = {};
            query.pricePerDay.$lte = parseFloat(req.query.maxPrice);
            queryParamsForResponse.maxPrice = req.query.maxPrice;
        }
        // Add more filters here based on other fields if needed

        // Basic Pagination (optional, but good for APIs)
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10; // Default 10 items per page
        const skip = (page - 1) * limit;

        const cars = await Car.find(query).skip(skip).limit(limit);
        const totalCars = await Car.countDocuments(query);
        
        const pagination = {
            currentPage: page,
            totalPages: Math.ceil(totalCars / limit),
            totalCars: totalCars,
            limit: limit
        };

        return successResponse(res, 'Available cars fetched.', { cars, pagination, filtersApplied: queryParamsForResponse });
    } catch (err) {
        return next(err); // Pass to global error handler
    }
};

// Display details for a specific car (API)
exports.showCarDetails = async (req, res, next) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) {
            return errorResponse(res, 'Car not found.', 404);
        }
        // Public can view any car, availability for booking is separate concern
        return successResponse(res, 'Car details fetched.', { car });
    } catch (err) {
        if (err.kind === 'ObjectId') { // Handle invalid ObjectId format
             return errorResponse(res, 'Car not found (invalid ID format).', 400);
        }
        return next(err);
    }
};
