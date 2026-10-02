const Car = require('../../models/Car');
const { successResponse, errorResponse } = require('../../utils/apiResponse');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

// List all cars for Admin
exports.listCars = async (req, res, next) => {
    try {
        const cars = await Car.find();
        return successResponse(res, 'Cars fetched successfully.', { cars });
    } catch (err) {
        return next(err); // Pass to global error handler
    }
};

// Get details for a single car (for editing or viewing)
exports.getCarDetails = async (req, res, next) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) {
            return errorResponse(res, 'Car not found.', 404);
        }
        return successResponse(res, 'Car details fetched.', { car });
    } catch (err) {
        return next(err);
    }
};

// Add a new car (API)
exports.addCar = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed.', 422, errors.array());
    }

    const { make, model, year, pricePerDay, features, status } = req.body;
    const imageURL = req.file ? '/uploads/cars/' + req.file.filename : null;

    try {
        const newCar = new Car({
            make, model, year, pricePerDay, imageURL,
            status: status || 'available',
            features: features ? features.split(',').map(feature => feature.trim()) : [],
            // addedBy: req.session.user.id // If implemented
        });
        const savedCar = await newCar.save();
        return successResponse(res, 'Car added successfully.', { car: savedCar }, 201);
    } catch (err) {
        // Handle potential duplicate key errors or other DB errors if not caught by global handler
        if (err.code === 11000) {
             return errorResponse(res, 'A car with similar unique details already exists.', 409);
        }
        return next(err);
    }
};

// Edit an existing car (API)
exports.editCar = async (req, res, next) => {
    const carId = req.params.id;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed.', 422, errors.array());
    }

    try {
        const carToUpdate = await Car.findById(carId);
        if (!carToUpdate) {
            return errorResponse(res, 'Car not found.', 404);
        }

        const oldImageURL = carToUpdate.imageURL;
        carToUpdate.make = req.body.make;
        carToUpdate.model = req.body.model;
        carToUpdate.year = req.body.year;
        carToUpdate.pricePerDay = req.body.pricePerDay;
        carToUpdate.status = req.body.status || carToUpdate.status;
        carToUpdate.features = req.body.features ? req.body.features.split(',').map(feature => feature.trim()) : carToUpdate.features;

        if (req.file) {
            carToUpdate.imageURL = '/uploads/cars/' + req.file.filename;
            if (oldImageURL && oldImageURL !== carToUpdate.imageURL) {
                const oldImagePath = path.join(__dirname, '../../public', oldImageURL);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlink(oldImagePath, (errUnlink) => {
                        if (errUnlink) console.error("Error deleting old image:", errUnlink);
                    });
                }
            }
        }

        await carToUpdate.save();
        return successResponse(res, 'Car updated successfully.', { car: carToUpdate });
    } catch (err) {
         if (err.code === 11000) {
             return errorResponse(res, 'A car with similar unique details already exists.', 409);
        }
        return next(err);
    }
};

// Delete a car (API)
exports.deleteCar = async (req, res, next) => {
    const carId = req.params.id;
    try {
        const carToDelete = await Car.findById(carId);
        if (!carToDelete) {
            return errorResponse(res, 'Car not found.', 404);
        }

        if (carToDelete.imageURL) {
            const imagePath = path.join(__dirname, '../../public', carToDelete.imageURL);
            if (fs.existsSync(imagePath)) {
                fs.unlink(imagePath, (errUnlink) => {
                    if (errUnlink) console.error("Error deleting car image file:", errUnlink);
                });
            }
        }
        await Car.findByIdAndDelete(carId);
        return successResponse(res, 'Car deleted successfully.');
    } catch (err) {
        return next(err);
    }
};
// showAddCarForm and showEditCarForm are no longer needed.
