import { AiOutlineSearch } from 'react-icons/ai'; // Import the search icon
import { useContext,useEffect } from 'react';
import StudentContext from '../context/StudentContext'
import CourseContext from '../context/CourseContext'
import { useLocation } from 'react-router-dom';

const AdminNav = () => {
  // Define the function to handle file changes (you'll need to implement this function)
  
  let {getStudentsFromFile} =useContext(StudentContext)
  let {getCourse} = useContext(CourseContext)
  const handleFileChange = (event) => {
    if(isCourseRoute){
      console.log("for course")
      getCourse(event)
    }else{
      console.log("for students")
      getStudentsFromFile(event);
    }
  };
  const location = useLocation();

  const isCourseRoute = location.pathname === '/course';
  const placeholderText = location.pathname === '/course' ? 'Search Course':'Search Student..';


  return (
    <div className="bg-white sticky top-0">
      <div className="flex items-center">
        {/* Image */}
        <img className="h-16 relative pt-5" src="./images/iiitd_img.png" alt="not available" />

        {/* Text beside the image */}
        <div className="ml-2 flex items-center">
          <h3 className="font-bold text-center">Eligible Students of Monsoon 2023</h3>
        </div>
      </div>

      {/* Second row */}
      <div className="flex items-center justify-between mt-4">
        {/* CSE Department */}
        
        {/* Search bar */}
        <form className="w-[500px] ml-3">
          <div className="relative">
            <input
              type="search"
              placeholder={placeholderText}
              className="w-full p-4 rounded-full h-10 border border-[#3dafaa] outline-none focus:border-[#3dafaa]"
            />
            <button className="absolute right-0 top-1/2 -translate-y-1/2 p-3 bg-[#3dafaa] rounded-full search-button">
              <AiOutlineSearch />
            </button>
          </div>
        </form>

        {/* Upload XLSX button */}
          <label className="bg-[#3dafaa] text-white px-4 py-2 rounded cursor-pointer font-bold">
            Upload XLSX
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
    
      </div>
    </div>
  );
};

export default AdminNav;