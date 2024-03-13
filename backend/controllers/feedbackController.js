// feedbackController.js
const asyncHandler = require('express-async-handler');
const Feedback = require('../models/Feedback');
const Course = require('../models/Course');
const FeedbackStatus = require('../models/FeedbackStatus');

// Start generating dummy feedback
const startFeedback = asyncHandler(async (req, res) => {
    try {

        let feedbackStatus = await FeedbackStatus.findOne();
        if (!feedbackStatus) {
            feedbackStatus = new FeedbackStatus({ active: true });
        } else {
            feedbackStatus.active = true;
        }
        await feedbackStatus.save();

        // Check if any feedback records exist
        const feedbackCount = await Feedback.countDocuments();

        // If feedback records exist, return without generating new feedback
        if (feedbackCount > 0) {
            console.log('Feedback records already exist. Skipping generation.');
            return res.json({ message: 'Feedback records already exist' });
        }

        // Fetch or create the FeedbackStatus document
      
        // Fetch all courses with allocated TAs
        const courses = await Course.find().populate('taAllocated');

        // Iterate through courses
        for (const course of courses) {
            // Check if the course has any allocated TAs
            if (!course.taAllocated || course.taAllocated.length === 0) {
                // If there are no TAs allocated for this course, continue to the next course
                continue;
            }

            // Iterate through allocated TAs
            for (const ta of course.taAllocated) {
                // Create new feedback object
                const feedback = new Feedback({
                    course: course._id,
                    student: ta._id,
                    professor: course.professor,
                    rating: 5, // Default rating
                    description: '', // Optional description
                });

                // Save the feedback object
                await feedback.save();
            }
        }

        console.log('Dummy feedback objects generated successfully');
        res.json({ message: 'Dummy feedback generated successfully' });
    } catch (error) {
        console.error('Error generating dummy feedback:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});


// Edit feedback by ID
const editFeedbackById = asyncHandler(async (req, res) => {
    try {
        // Check if feedback form is open
        const feedbackStatus = await FeedbackStatus.findOne();
        if (!feedbackStatus || !feedbackStatus.active) {
            return res.status(403).json({ message: "Feedback form is closed. Cannot edit feedback." });
        }

        const { id } = req.params;
        const { rating, description } = req.body;

        const feedback = await Feedback.findById(id);
        if (!feedback) {
            return res.status(404).json({ message: "Feedback not found" });
        }

        feedback.rating = rating !== undefined ? rating : feedback.rating;
        feedback.description = description !== undefined ? description : feedback.description;

        await feedback.save();
        res.json({ message: "Feedback updated successfully", feedback });
    } catch (error) {
        console.error("Error updating feedback:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});




// Get feedbacks by professor ID
const getFeedbacksByProfessorId = asyncHandler(async (req, res) => {
    try {
        const { professorId } = req.params;

        const feedbacks = await Feedback.find({ professor: professorId });
        res.json({ feedbacks });
    } catch (error) {
        console.error("Error fetching feedbacks by professor ID:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

// Get all feedbacks
const getAllFeedbacks = asyncHandler(async (req, res) => {
    try {
        const feedbacks = await Feedback.find();
        res.json({ feedbacks });
    } catch (error) {
        console.error("Error fetching all feedbacks:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

// Close the feedback form
const closeFeedback = asyncHandler(async (req, res) => {
    try {
        // Update the feedback status to inactive
        let feedbackStatus = await FeedbackStatus.findOne();
        if (!feedbackStatus) {
            feedbackStatus = new FeedbackStatus({ active: false });
        } else {
            feedbackStatus.active = false;
        }
        await feedbackStatus.save();
        res.json({ message: 'Feedback form closed successfully' });
    } catch (error) {
        console.error('Error closing feedback form:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

const getFeedbackStatus = asyncHandler(async (req, res) => {
    try {
        // Find the feedback status
        const feedbackStatus = await FeedbackStatus.findOne();

        if (!feedbackStatus) {
            // If no feedback status is found, return false
            return res.json({ active: false });
        }

        // Return the feedback status
        res.json({ active: feedbackStatus.active });
    } catch (error) {
        console.error('Error fetching feedback status:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

module.exports = { startFeedback, editFeedbackById, getFeedbacksByProfessorId, getAllFeedbacks, closeFeedback,getFeedbackStatus };