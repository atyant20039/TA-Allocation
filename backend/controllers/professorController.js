const asyncHandler = require( 'express-async-handler' );
const Professor = require( "../models/Professor" );
const Course = require( "../models/Course" );
const argon2 = require( 'argon2' );


//@desc Get professor by ID
//@route GET /api/professor/:id
//@access public
const getProfessor = asyncHandler( async ( req, res ) =>
{
    const professor = await Professor.findById( req.params.id );

    if ( !professor || professor.length === 0 )
    {
        res.status( 404 );
        throw new Error( "No Professor Found" );
    }
    res.status( 200 ).json( professor );
} );

//@desc Get filtered professors
//@route GET /api/professor?filters
//@access public
const getProfessors = asyncHandler( async ( req, res ) =>
{
    try
    {
        const { name, emailId } = req.query;

        var filter = {};
        if ( name ) filter.name = new RegExp( name, 'i' );
        if ( emailId ) filter.emailId = new RegExp( emailId, 'i' );

        const filteredProfessors = await Professor.find( filter );
        res.status( 200 ).json( filteredProfessors );

    } catch ( error )
    {
        res.status( 500 ).json( { message: 'Internal server error', error: error.message } );
    }
} );

//@desc Add new professor
//@route POST /api/professor
//@access public
const addProfessor = asyncHandler( async ( req, res ) =>
{
    try
    {
        var professorsToAdd = req.body;

        // If a single professor object is provided, convert it to an array of one professor
        if ( !Array.isArray( professorsToAdd ) )
        {
            professorsToAdd = [ professorsToAdd ];
        }

        var invalidProfessors = [];

        for ( const professor of professorsToAdd )
        {
            // Check if all required fields are present
            const requiredFields = [ 'emailId', 'password', 'name' ];
            const missingFields = requiredFields.filter( ( field ) => !professor[ field ] );
            if ( missingFields.length > 0 )
            {
                invalidProfessors.push( {
                    professor: professor,
                    message: `Missing required fields: ${ missingFields.join( ', ' ) }`,
                } );
                continue; // Skip this professor and move to the next one
            }

            // Check for emailId collisions
            const existingProfessor = await Professor.findOne( { emailId: professor.emailId } );
            if ( existingProfessor )
            {
                invalidProfessors.push( {
                    professor: professor,
                    message: 'Email already taken',
                } );
                continue; // Skip this professor and move to the next one
            }

            // Hash the password using Argon2 before saving
            try
            {
                const hash = await argon2.hash( professor.password );
                professor.password = hash;
            } catch ( error )
            {
                invalidProfessors.push( {
                    professor: professor,
                    message: 'Error hashing the password',
                } );
                continue; // Skip this professor and move to the next one
            }
        }

        // Filter out invalid professors
        professorsToAdd = professorsToAdd.filter( ( professor ) =>
            !invalidProfessors.some( ( invalidProf ) => invalidProf.professor.emailId === professor.emailId )
        );

        // Insert valid professors into the database
        await Professor.insertMany( professorsToAdd );

        return res.status( 201 ).json( {
            message: 'Professors added successfully',
            invalidProfessors: invalidProfessors,
        } );
    } catch ( error )
    {
        return res.status( 500 ).json( { message: 'Internal server error', error: error.message } );
    }
} );

//@desc Update professor data
//@route PUT /api/professor/:id
//@access public
const updateProfessor = asyncHandler( async ( req, res ) =>
{
    const professorId = req.params.id;
    var updates = req.body;

    try
    {
        // Step 1: Validate that the professor exists
        var professor = await Professor.findById( professorId );
        if ( !professor )
        {
            return res.status( 404 ).json( { message: 'Professor not found' } );
        }

        // Step 2: Check if emailId is being updated and if it collides with an existing email
        if ( 'emailId' in updates && updates.emailId !== professor.emailId )
        {
            const existingProfessor = await Professor.findOne( { emailId: updates.emailId } );
            if ( existingProfessor )
            {
                return res.status( 400 ).json( { message: 'Email already taken' } );
            }
        }

        // Step 3: Check if password is being updated and perform necessary security checks
        if ( 'password' in updates )
        {
            // Hash the new password
            const hash = await argon2.hash( updates.password );
            updates.password = hash;
        }

        // Step 4: Update the professor with the validated values
        const updatedProfessor = await Professor.findByIdAndUpdate( professorId, updates, { new: true } );

        return res.status( 200 ).json( { message: 'Professor updated successfully', professor: updatedProfessor } );
    } catch ( error )
    {
        return res.status( 500 ).json( { message: 'Internal server error', error: error.message } );
    }
} );

//@desc Delete professor by id
//@route DELETE /api/professor/:id
//@access public
const deleteProfessor = asyncHandler( async ( req, res ) =>
{
    const professorId = req.params.id;

    try
    {
        // Check if the professor exists
        const professor = await Professor.findById( professorId );
        if ( !professor )
        {
            return res.status( 404 ).json( { message: 'Professor not found' } );
        }

        // Update related Courses by setting the "professor" field to null
        await Course.updateMany( { professor: professorId }, { professor: null } );

        // Delete the professor
        await Professor.findByIdAndRemove( professorId );

        return res.status( 200 ).json( { message: 'Professor deleted successfully' } );
    } catch ( error )
    {
        return res.status( 500 ).json( { message: 'Internal server error', error: error.message } );
    }
} );

module.exports = { getProfessor, addProfessor, updateProfessor, deleteProfessor, getProfessors };