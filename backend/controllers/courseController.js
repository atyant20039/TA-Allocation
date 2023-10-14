const asyncHandler = require( 'express-async-handler' );
const Course = require( "../models/Course" );
const JM = require( "../models/JM" );
const Professor = require( "../models/Professor" );
const { getProfessors } = require('./professorController');


//@desc Get course by ID
//@route GET /api/course/:id
//@access public
const getCourse = asyncHandler( async ( req, res ) =>
{
    const course = await Course.findById( req.params.id );

    if ( !course || course.length === 0 )
    {
        res.status( 404 );
        throw new Error( "No Course Found" );
    }
    res.status( 200 ).json( course );
} );

//@desc Get filtered courses
//@route GET /api/course?filters
//@access public
const getCourses = asyncHandler( async ( req, res ) =>
{
    const { name, code, acronym, department, professor, credits } = req.query;

    const filter = {};
    if ( name ) filter.program = name;
    if ( code ) filter.code = code;
    if ( acronym ) filter.acronym = acronym;
    if ( credits ) filter.credits = parseInt( credits );
    try
    {
        if ( department )
        {
            const departmentId = await JM.findOne( { department: department } ).select( '_id' );
            if ( departmentId )
            {
                filter.department = departmentId._id;
            }
        }
        if ( professor )
        {
            const professorId = await Professor.findOne( { name: professor } ).select( '_id' );
            if ( professorId )
            {
                filter.professor = professorId._id;
            }
        }

        const filteredCourses = await Course.find( filter );
        res.status( 200 ).json( filteredCourses );
    } catch ( error )
    {
        res.status( 500 ).json( { error: 'Server error' } );
    }
} );

//@desc Add new course
//@route POST /api/course
//@access public
const addCourse = asyncHandler( async ( req, res ) =>
{
    let newCourses = req.body;
    console.log(newCourses)

    if ( !Array.isArray( newCourses ) )
    {
        newCourses = [ newCourses ];
    }

    try
    {
        const collidingCourses = [];
        const invalidDeptCourses = [];
        const invalidProfCourses = [];

        for ( const newCourse of newCourses )
        {
            // Check if required fields are not empty and have correct values
            if ( !newCourse.name || !newCourse.code || !newCourse.acronym || !newCourse.department || !newCourse.totalStudents || !newCourse.taStudentRatio )
            {
                return res.status( 400 ).json( { message: 'All required fields must be provided' } );
            }

            if ( parseInt( newCourse.taStudentRatio ) < 1 )
            {
                return res.status( 400 ).json( { message: 'TA to Student Ratio should be greater than 1' } );
            }

            if ( newCourse.taAllocated )
            {
                delete newCourse.taAllocated;
            }

            // Calculate taRequired

            newCourse.taRequired = Math.floor( newCourse.totalStudents / newCourse.taStudentRatio );

            // Handle "department" reference
            if ( newCourse.department )
            {
                const jmDepartment = await JM.findOne( { department: newCourse.department } );
                if ( jmDepartment )
                {
                    newCourse.department = jmDepartment._id;
                } else
                {
                    invalidDeptCourses.push( newCourse );
                    continue; // Skip adding this course
                }
            }

            // Handle "professor" reference
            if ( newCourse.professor )
            {
                const professor = await Professor.findOne( { name: newCourse.professor } );
                if ( professor )
                {
                    newCourse.professor = professor._id;
                } else
                {
                    invalidProfCourses.push( newCourse );
                    // newCourse.professor = null; // Assign null if professor not found
                    continue; // Skip adding this course
                }
                console.log(professor)
            }

            // Check for collisions based on the index
            const existingCourse = await Course.findOne( {
                acronym: newCourse.acronym,
                professor: newCourse.professor,
                name: newCourse.name,
            } );
            if ( existingCourse )
            {
                collidingCourses.push( newCourse );
            } else
            {
                // Add the course to the database
                const createdCourse = await Course.create( newCourse );
            }
        }

        // Prepare the response
        const response = {
            message: 'Courses added successfully',
            collide: collidingCourses,
            invalid_dept: invalidDeptCourses,
            invalid_prof: invalidProfCourses,
        };

        return res.status( 201 ).json( response );
    } catch ( error )
    {
        return res.status( 500 ).json( { message: 'Internal server error', error: error.message } );
    }
} );

//@desc Update course data
//@route PUT /api/course/:id
//@access public
const updateCourse = asyncHandler( async ( req, res ) =>
{ //update tareq according to the changes
    const courseId = req.params.id;
    const updates = req.body;

    try
    {
        const course = await Course.findById( courseId );
        if ( !course )
        {
            return res.status( 404 ).json( { message: 'Course not found' } );
        }

        if ( updates.department )
        {
            const jmDepartment = await JM.findOne( { department: updates.department } );
            if ( !jmDepartment )
            {
                return res.status( 400 ).json( { message: 'Invalid Department value' } );
            }
            updates.department = jmDepartment._id;
        }

        if ( updates.professor )
        {
            const professor = await Professor.findOne( { name: updates.professor } );
            if ( !professor )
            {
                return res.status( 400 ).json( { message: 'Invalid Professor value' } );
            }
            updates.professor = professor._id;
        }

        if ( parseInt( updates.taStudentRatio ) < 1 )
        {
            delete updates.taStudentRatio;
        }

        if ( updates.taAllocated )
        {
            delete updates.taAllocated;
        }

        const updatedCourse = await Course.findByIdAndUpdate( courseId, updates, { new: true } );

        return res.status( 200 ).json( { message: 'Course updated successfully', course: updatedCourse } );
    } catch ( error )
    {
        return res.status( 500 ).json( { message: 'Internal server error', error: error.message } );
    }
} );

//@desc Delete a course by ID
//@route DELETE /api/course/:id
//@access public
const deleteCourse = asyncHandler( async ( req, res ) =>
{
    const courseId = req.params.id;

    try
    {
        // Step 1: Validate that the course exists
        const course = await Course.findById( courseId );
        if ( !course )
        {
            return res.status( 404 ).json( { message: 'Course not found' } );
        }

        // Step 2: Get the list of student IDs from the allocatedTA field
        const studentIds = course.taAllocated;

        // Step 3: Set taAllocated to null for students in the list
        await Student.updateMany(
            { _id: { $in: studentIds } },
            { $set: { allocatedTA: null } }
        );

        // Step 4: Delete the course
        await Course.findByIdAndRemove( courseId );

        return res.status( 200 ).json( { message: 'Course deleted successfully' } );

    } catch ( error )
    {
        // Handle any potential errors
        res.status( 500 ).json( { error: 'Server error' } );
    }
} );


module.exports = { getCourse, addCourse, updateCourse, deleteCourse, getCourses };