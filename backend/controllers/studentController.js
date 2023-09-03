const asyncHandler = require('express-async-handler');
const Student = require("../models/Student");


//@desc Get all students
//@route GET /api/student
//@access public
const getAllStudents = asyncHandler(async (req, res) => {
    const students = await Student.find();
    res.status(200).json(students);
});

//@desc Get student by ID
//@route GET /api/student/:id
//@access public
const getStudent = asyncHandler(async (req, res) => {
    try {
        const student = await Student.findOne({
            $or: [
                { _id: req.params.id },
                { emailId: req.params.id },
                { rollNo: req.params.id }
            ]
        });
        if (student.length === 0) {
            res.status(404);
            throw new Error("No Student Found");
        }
        res.status(200).json(student);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

//@desc Add new student
//@route POST /api/student
//@access public
const addStudent = asyncHandler(async (req, res) => {
    console.log("The request data is ", req.body);
    // req.body format
    // {name, emailId, gender, program, department, rollNo, mandatoryTa, year, allocated}
    const { name, emailId, gender, program, department, rollNo, mandatoryTa, year, allocated } = req.body;
    if (!name || !emailId || !program || !department || !rollNo || !year) {
        res.status(400);
        throw new Error("Please fill all mandatory fields");
    }

    const student = await Student.create(req.body);
    res.status(201).json(student);
});

//@desc Update student data
//@route PUT /api/student/:id
//@access public
const updateStudent = asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) {
        res.status(404);
        throw new Error("No Student Found");
    }

    const updatedStudent = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updatedStudent);
});

//@desc Delete student by id
//@route DELETE /api/student/:id
//@access public
const deleteStudent = asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) {
        res.status(404);
        throw new Error("No Student Found");
    }
    await Student.deleteOne({ _id: req.params.id });
    res.status(200).json(student);
});

module.exports = { getAllStudents, getStudent, addStudent, updateStudent, deleteStudent };