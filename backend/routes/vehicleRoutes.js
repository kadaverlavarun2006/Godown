const express = require('express');
const mongoose = require('mongoose');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');

const router = express.Router();

const validateDriver = async(driverId) => {
    if (driverId === null || driverId === undefined || driverId === '') {
        return null;
    }

    if (!mongoose.isValidObjectId(driverId)) {
        throw new Error('A valid driver is required');
    }

    const driver = await Driver.findOne({ _id: driverId, active: true });
    if (!driver) {
        throw new Error('Active driver not found');
    }

    return driver._id;
};

router.get('/', async(req, res) => {
    try {
        const vehicles = await Vehicle.find()
            .populate('assignedDriver', 'name phone licenseNumber active')
            .sort({ vehicleNumber: 1 });
        res.json(vehicles);
    } catch (error) {
        res.status(500).json({ message: 'Unable to fetch vehicles' });
    }
});

router.post('/', async(req, res) => {
    try {
        const { vehicleNumber, vehicleType, capacity, assignedDriver } = req.body;
        const validDriver = await validateDriver(assignedDriver);
        const vehicle = await Vehicle.create({
            vehicleNumber,
            vehicleType,
            capacity,
            assignedDriver: validDriver
        });
        await vehicle.populate('assignedDriver', 'name phone licenseNumber active');
        res.status(201).json(vehicle);
    } catch (error) {
        const message = error.code === 11000 ? 'Vehicle number already exists' : error.message || 'Unable to create vehicle';
        res.status(400).json({ message, error: error.message });
    }
});

router.put('/:id', async(req, res) => {
    try {
        const updates = {
            vehicleNumber: req.body.vehicleNumber,
            vehicleType: req.body.vehicleType,
            capacity: req.body.capacity
        };

        if (Object.prototype.hasOwnProperty.call(req.body, 'assignedDriver')) {
            updates.assignedDriver = await validateDriver(req.body.assignedDriver);
        }

        const vehicle = await Vehicle.findByIdAndUpdate(
            req.params.id,
            updates, { new: true, runValidators: true }
        ).populate('assignedDriver', 'name phone licenseNumber active');

        if (!vehicle) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        res.json(vehicle);
    } catch (error) {
        const message = error.code === 11000 ? 'Vehicle number already exists' : error.message || 'Unable to update vehicle';
        res.status(400).json({ message, error: error.message });
    }
});

router.patch('/:id/assignment', async(req, res) => {
    try {
        const assignedDriver = await validateDriver(req.body.driverId);
        const vehicle = await Vehicle.findByIdAndUpdate(
            req.params.id, { assignedDriver }, { new: true, runValidators: true }
        ).populate('assignedDriver', 'name phone licenseNumber active');

        if (!vehicle) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        res.json(vehicle);
    } catch (error) {
        res.status(400).json({ message: error.message || 'Unable to update vehicle assignment' });
    }
});

module.exports = router;