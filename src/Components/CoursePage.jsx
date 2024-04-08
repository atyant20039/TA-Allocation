import React, { useContext, useEffect, useState } from "react";
import CourseContext from "../context/CourseContext";
import Swal from "sweetalert2";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import StudentContext from "../context/StudentContext";
import axios from "axios";
import AuthContext from "../context/AuthContext";
import * as XLSX from "xlsx";
import { AiOutlineSearch } from "react-icons/ai";
import { AiOutlineSortAscending } from "react-icons/ai";
import { AiOutlineSortDescending } from "react-icons/ai";

const CoursePage = () => {
  const { selectedCourse } = useContext(CourseContext);
  const { students, getStudentsFromBackend } = useContext(StudentContext);
  const [button, setbutton] = useState(false);
  const { user } = useContext(AuthContext);
  const { courseName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [allocatedToThisCourse, setAllocatedToThisCourse] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [allocated, setAllocated] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentRound, setCurrentRound] = useState(null);
  const [prefFilter, setPrefFilter] = useState("All");
  const [programFilter, setProgramFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });
  console.log(students);
  const [sorted, setSorted] = useState([]);

  const fetchCurrentRound = async () => {
    try {
      const response = await fetch("http://localhost:5001/api/rd/currentround");
      const data = await response.json();
      setCurrentRound(data.currentRound);
    } catch (error) {
      console.error("Error fetching round status:", error);
    }
  };

  useEffect(() => {
    if (!selectedCourse || selectedCourse.name !== courseName) {
      // Redirect to the professor page if conditions are met
      const currentPath = location.pathname;
      const lastIndexOfSlash = currentPath.lastIndexOf("/");

      if (lastIndexOfSlash !== -1) {
        // Extract the modified path
        const modifiedPath = currentPath.substring(0, lastIndexOfSlash);

        // Navigate to the modified path
        navigate(modifiedPath);
      }
    }

    // When the component mounts, sort students into allocated and available lists
    const studentsAllocatedToCourse = students.filter(
      (student) =>
        student.allocationStatus === 1 &&
        student.allocatedTA === selectedCourse.name
    );

    const studentsAvailableForAllocation = students.filter(
      (student) =>
        student.allocationStatus !== 1 ||
        student.allocatedTA !== selectedCourse.name
    );

    fetchCurrentRound();

    setAllocatedToThisCourse(studentsAllocatedToCourse);

    setAvailableStudents(studentsAvailableForAllocation);
  }, [selectedCourse, students, allocated]);

  const handleAllocate = (studentId) => {
    if (currentRound == null) {
      Swal.fire("Can't Allocate", "No allocation round is going on", "error");
    } else {
      // Make a POST request to allocate the student
      axios
        .post("http://localhost:5001/api/al/allocation", {
          studentId,
          courseId: selectedCourse._id,
          allocatedByID: user.id,
          allocatedBy: user.role,
        })
        .then((response) => {
          // Allocation was successful

          // Move the student from available to allocated
          const studentToAllocate = availableStudents.find(
            (student) => student._id === studentId
          );

          setAllocatedToThisCourse((prevAllocated) => [
            ...prevAllocated,
            studentToAllocate,
          ]);
          setAvailableStudents((prevAvailable) =>
            prevAvailable.filter((student) => student._id !== studentId)
          );

          getStudentsFromBackend();

          // Toggle the button state to trigger recalculation
          setbutton((prevState) => !prevState);
        })
        .catch((error) => {
          if (error.message === "Request failed with status code 400") {
            Swal.fire("Can't Allocate", "TA limit exceeded.", "error");
          }
          console.error("Error allocating student:", error);
        });
    }
  };

  const prefRank = (student) => {
    let rank = 9;
    let count = 0;
    for (const i of student.departmentPreferences) {
      count++;
      if (i.course === selectedCourse.name) {
        rank = count;
        break;
      }
    }
    for (const i of student.nonDepartmentPreferences) {
      count++;
      if (rank < 9) {
        break;
      }
      if (i.course === selectedCourse.name) {
        rank = count;
        break;
      }
    }
    return rank;
  };

  const handleSort = (key) => {
    // Toggle the sorting direction if the same key is clicked again
    const direction =
      key === sortConfig.key && sortConfig.direction === "ascending"
        ? "descending"
        : "ascending";

    // Sort the data based on the selected key and direction
    const sortedStudents = [
      ...(allocated === 1 ? allocatedToThisCourse : availableStudents),
    ].sort((a, b) => {
      if (key === "preference") {
        let x = prefRank(a);
        let y = prefRank(b);
        if (x < y) {
          return direction === "ascending" ? -1 : 1;
        }
        if (x > y) {
          return direction === "ascending" ? 1 : -1;
        }
        return 0;
      } else {
        const valueA = a[key].toString().toLowerCase();
        const valueB = b[key].toString().toLowerCase();
        if (valueA < valueB) {
          return direction === "ascending" ? -1 : 1;
        }
        if (valueA > valueB) {
          return direction === "ascending" ? 1 : -1;
        }
        return 0;
      }
    });

    // Update the sort configuration
    setSortConfig({ key, direction });

    // Update the sorted data in state
    setSorted(sortedStudents);
  };

  const handleDeallocate = (studentId) => {
    // Make a POST request to deallocate the student
    axios
      .post("http://localhost:5001/api/al/deallocation", {
        studentId: studentId,
        deallocatedByID: user.id,
        deallocatedBy: user.role,
        courseId: selectedCourse._id,
      })
      .then((response) => {
        // Deallocation was successful

        // Move the student from allocated to available
        const studentToDeallocate = allocatedToThisCourse.find(
          (student) => student._id === studentId
        );

        setAvailableStudents((prevAvailable) => [
          ...prevAvailable,
          studentToDeallocate,
        ]);
        setAllocatedToThisCourse((prevAllocated) =>
          prevAllocated.filter((student) => student._id !== studentId)
        );

        getStudentsFromBackend();

        // Toggle the button state to trigger recalculation
        setbutton((prevState) => !prevState);
      })
      .catch((error) => {
        // Handle any errors, e.g., display an error message
        console.error("Error deallocating student:", error);
      });
  };

  if (!selectedCourse) {
    // Render a message or UI indicating that the course data is not available
    return <div>Course data is not available.</div>;
  }

  const handleRenderAllocatedTable = async () => {
    setAllocated(1);
    setSortConfig({ key: null, direction: "ascending" });
    setProgramFilter("All");
    setDepartmentFilter("All");
    setPrefFilter("All");
  };

  const handleRenderAvailableStudentTable = async () => {
    setAllocated(0);
    setSortConfig({ key: null, direction: "ascending" });
    setProgramFilter("All");
    setDepartmentFilter("All");
    setPrefFilter("All");
  };

  const handleRenderAllocatedToOthersTable = async () => {
    setAllocated(2);
    setSortConfig({ key: null, direction: "ascending" });
    setProgramFilter("All");
    setDepartmentFilter("All");
    setPrefFilter("All");
  };

  const handleDownload = () => {
    const dataToDownload = allocated
      ? allocatedToThisCourse.map(
          ({ _id, allocationStatus, __v, ...rest }) => rest
        ) // Exclude _id and allocationStatus from allocatedToThisCourse
      : availableStudents.map(
          ({ _id, allocationStatus, __v, ...rest }) => rest
        ); // Exclude _id and allocationStatus from availableStudents

    const ws = XLSX.utils.json_to_sheet(dataToDownload);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(
      wb,
      `${selectedCourse.name}_${
        allocated ? "Allocated" : "Available"
      }_Students.xlsx`
    );
  };

  const filterStudents = (studentsList) => {
    if (
      prefFilter === "All" &&
      programFilter === "All" &&
      departmentFilter === "All"
    ) {
      return studentsList.filter(
        (student) =>
          student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          student.emailId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      const filteredStudents = []; // Initialize an empty array to collect matching students
      if (prefFilter !== "All") {
        for (const student of studentsList) {
          let pref = "Not Any";
          let count = 1;
          for (const i of student.departmentPreferences) {
            if (i.course === selectedCourse.name) {
              pref = `Dept Preference ${count}`;
              break;
            }
            count++;
          }
          for (const i of student.nonDepartmentPreferences) {
            if (pref !== "Not Any") {
              break;
            }
            if (i.course === selectedCourse.name) {
              pref = `Other Preference ${count}`;
              break;
            }
            count++;
          }
          if (
            pref === prefFilter &&
            (student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              student.emailId.toLowerCase().includes(searchQuery.toLowerCase()))
          ) {
            filteredStudents.push(student); // Add matching student to the array
          }
        }
      } else if (programFilter !== "All") {
        for (const student of studentsList) {
          if (
            student.program === programFilter &&
            (student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              student.emailId.toLowerCase().includes(searchQuery.toLowerCase()))
          ) {
            filteredStudents.push(student);
          }
        }
      } else if (departmentFilter !== "All") {
        for (const student of studentsList) {
          if (
            student.department === departmentFilter &&
            (student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              student.emailId.toLowerCase().includes(searchQuery.toLowerCase()))
          ) {
            filteredStudents.push(student);
          }
        }
      }
      return filteredStudents; // Return the array of matching students
    }
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredStudents = filterStudents(
    sortConfig.key === null
      ? allocated === 1
        ? allocatedToThisCourse
        : availableStudents
      : sorted
  );

  // Function to check if a course is in the student's preferences

  const findCourseInPreferences = (student, courseName) => {
    let count = 1;
    for (const preference of student.departmentPreferences) {
      if (preference.course === courseName) {
        return {
          preferenceType: "Department Preference " + count,
          grade: preference.grade,
        };
      }
      count++;
    }
    count = 1;
    for (const preference of student.nonDepartmentPreferences) {
      if (preference.course === courseName) {
        return {
          preferenceType: "Non-Department Preference " + count,
          grade: preference.grade,
        };
      }
      count++;
    }
    return null; // Course not found in preferences
  };

  // Updated renderAllocatedRow function
  const renderAllocatedRow = (student) => {
    let pref = "Not Any";
    let grade = "No Grade"; // Initialize grade variable
    const coursePreference = findCourseInPreferences(
      student,
      selectedCourse.name
    );
    if (coursePreference !== null) {
      pref = coursePreference.preferenceType;
      grade = coursePreference.grade;
    }
    return (
      <tr key={student._id} className="text-center">
        <td className="border p-2">{student.name}</td>
        <td className="border p-2">{student.emailId}</td>
        <td className="border p-2">{student.program}</td>
        <td className="border p-2">{student.department}</td>
        {currentRound === 1 ? (
                <>
                  <td className="border p-2">{student.cgpa}</td>
                  <td className="border p-2">{grade}</td> {/* Display grade */}
                  <td className="border p-2">{pref}</td>
                </>
              ) : null}
        <td className="border p-2">
          <button
            className="bg-red-500 text-white px-4 py-2 rounded cursor-pointer font-bold"
            onClick={() => handleDeallocate(student._id)}
          >
            Deallocate
          </button>
        </td>
      </tr>
    );
  };

  // Updated renderAvailableRow function
  const renderAvailableRow = (student) => {
    let pref = "Not Any";
    let grade = "No Grade"; // Initialize grade variable
    const coursePreference = findCourseInPreferences(
      student,
      selectedCourse.name
    );
    if (coursePreference !== null) {
      pref = coursePreference.preferenceType;
      grade = coursePreference.grade;
    }
    return (
      <>
        {pref !== "Not Any" ||
        student.department === selectedCourse.department ||
        currentRound !== 2 ? (
          student.allocationStatus === 0 ? (
            <tr key={student._id} className="text-center">
              <td className="border p-2">{student.name}</td>
              <td className="border p-2">{student.emailId}</td>
              <td className="border p-2">{student.program}</td>
              <td className="border p-2">{student.department}</td>
              {currentRound === 1 ? (
                <>
                  <td className="border p-2">{student.cgpa}</td>
                  <td className="border p-2">{grade}</td> {/* Display grade */}
                  <td className="border p-2">{pref}</td>
                </>
              ) : null}

              <td className="border p-2">
                <button
                  className={`${
                    student.allocationStatus === 1 &&
                    student.allocatedTA !== selectedCourse.name
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#3dafaa] cursor-pointer"
                  } text-white px-4 py-2 rounded font-bold`}
                  onClick={() => handleAllocate(student._id)}
                  disabled={
                    student.allocationStatus === 1 &&
                    student.allocatedTA !== selectedCourse.name &&
                    currentRound === null
                  }
                >
                  Allocate
                </button>
              </td>
            </tr>
          ) : null
        ) : null}
      </>
    );
  };

  // Updated renderAllocatedToOthers function
  const renderAllocatedToOthers = (student) => {
    let pref = "Not Any";
    let grade = "No Grade"; // Initialize grade variable
    const coursePreference = findCourseInPreferences(
      student,
      selectedCourse.name
    );
    if (coursePreference !== null) {
      pref = coursePreference.preferenceType;
      grade = coursePreference.grade;
    }
    return (
      <>
        {student.allocationStatus === 1 &&
        student.allocatedTA !== selectedCourse.name ? (
          <tr key={student._id} className="text-center">
            <td className="border p-2">{student.name}</td>
            <td className="border p-2">{student.emailId}</td>
            <td className="border p-2">{student.program}</td>
            <td className="border p-2">{student.department}</td>
            {currentRound === 1 ? (
                <>
                  <td className="border p-2">{student.cgpa}</td>
                  <td className="border p-2">{grade}</td> 
                  <td className="border p-2">{pref}</td>
                </>
              ) : null}
            <td className="border p-2">{student.allocatedTA}</td>
          </tr>
        ) : null}
      </>
    );
  };

  const handlePrefFilter = (event) => {
    setPrefFilter(event.target.value);
  };

  const handleProgramFilter = (event) => {
    setProgramFilter(event.target.value);
  };

  const handleDepartmentFilter = (event) => {
    setDepartmentFilter(event.target.value);
  };

  const renderCommonHeader = (title, currentRound, handlePrefFilter) => {
    return (
      <div className="flex">
        <h2 className="text-2xl font-bold mb-2 mr-2">{title}</h2>
        {currentRound !== 1 && (
          <div className="mb-1 mr-2">
            <h2 className="mt-2 mr-2 inline-block">Preference:</h2>
            <select
              name=""
              id=""
              className="px-2 py-2 border border-[#3dafaa] rounded inline-block"
              onChange={handlePrefFilter}
            >
              <option value="All">All</option>
              <option value="Dept Preference 1">Dept Preference 1</option>
              <option value="Dept Preference 2">Dept Preference 2</option>
              <option value="Other Preference 1">Other Preference 1</option>
              <option value="Other Preference 2">Other Preference 2</option>
              <option value="Other Preference 3">Other Preference 3</option>
              <option value="Other Preference 4">Other Preference 4</option>
              <option value="Other Preference 5">Other Preference 5</option>
              <option value="Not Any">Not Any</option>
            </select>
          </div>
        )}
        <div className="mb-1 mr-2">
          <h2 className="mt-2 mr-2 inline-block">Program:</h2>
          <select
            name=""
            id=""
            className="px-2 py-2 border border-[#3dafaa] rounded inline-block"
            onChange={handleProgramFilter}
          >
            <option value="All">All</option>
            <option value="B.Tech 3rd Year">B.Tech 3rd Year</option>
            <option value="B.Tech 4th Year">B.Tech 4th Year</option>
            <option value="M.Tech 1st Year">M.Tech 1th Year</option>
            <option value="M.Tech 2nd Year">M.Tech 2nd Year</option>
            <option value="PhD">PhD</option>
          </select>
        </div>

        <div className="mb-1 mr-2">
          <h2 className="mt-2 mr-2 inline-block">Department:</h2>
          <select
            name=""
            id=""
            className="px-2 py-2 border border-[#3dafaa] rounded inline-block"
            onChange={handleDepartmentFilter}
          >
            <option value="All">All</option>
            <option value="CSE">CSE</option>
            <option value="CB">CB</option>
            <option value="Maths">Maths</option>
            <option value="HCD">HCD</option>
            <option value="ECE">ECE</option>
            <option value="SSH">SSH</option>
          </select>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex">
        <h1 className="text-3xl font-bold m-5">{selectedCourse.name},</h1>
        <div className="flex items-center">
          <p className="text-2xl font-bold mr-2">Ongoing Round:</p>
          <p className=" text-2xl flex mr-1">Round</p>
          <p className=" text-2xl flex">{currentRound}</p>
        </div>
      </div>
      <div className="flex justify-between">
        <div className="flex">
          <button
            type="button"
            className={`px-4 py-1 rounded-full cursor-pointer border border-[#3dafaa] ${
              allocated === 0 ? "bg-[#3dafaa] text-white" : "text-[#3dafaa]"
            } hover:bg-[#3dafaa] hover:text-white mr-4`}
            onClick={handleRenderAvailableStudentTable}
          >
            Available Student
          </button>
          <button
            type="button"
            className={`px-4 py-1 rounded-full cursor-pointer border border-[#3dafaa] ${
              allocated === 1 ? "bg-[#3dafaa] text-white" : "text-[#3dafaa]"
            } hover:bg-[#3dafaa] hover:text-white mr-2`}
            onClick={handleRenderAllocatedTable}
          >
            Student Allocated to {selectedCourse.acronym}
          </button>
          <button
            type="button"
            className={`px-4 py-1 rounded-full cursor-pointer border border-[#3dafaa] ${
              allocated === 2 ? "bg-[#3dafaa] text-white" : "text-[#3dafaa]"
            } hover:bg-[#3dafaa] hover:text-white mr-2`}
            onClick={handleRenderAllocatedToOthersTable}
          >
            Student Allocated to others courses
          </button>

          <form className="w-[350px]">
            <div className="relative mr-2">
              <input
                type="search"
                placeholder="Search Student..."
                className="w-full p-4 rounded-full h-10 border border-[#3dafaa] outline-none focus:border-[#3dafaa]"
                value={searchQuery}
                onChange={handleSearch}
              />
              <button className="absolute right-0 top-1/2 -translate-y-1/2 p-3 bg-[#3dafaa] rounded-full search-button">
                <AiOutlineSearch />
              </button>
            </div>
          </form>
        </div>
        {allocated == 1 ? (
          <button
            className="bg-[#3dafaa] text-white px-4 py-2 rounded cursor-pointer font-bold mr-6"
            onClick={handleDownload}
          >
            Download
          </button>
        ) : null}
      </div>

      {allocated === 1 && (
        <div className="m-5">
          {renderCommonHeader(
            `Allocated Students to ${courseName}`,
            currentRound,
            handlePrefFilter
          )}

          <div className="overflow-auto ">
            <table className="w-full border-collapse border">
              <thead className="sticky top-0">
                <tr className="bg-gray-200 text-gray-700 ">
                  <th className="border p-2 text-center ">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("name")}
                        className="flex justify-center"
                      >
                        Name{" "}
                        {sortConfig.key === "name" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>
                  <th className="border p-2 text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("emailId")}
                        className="flex justify-center"
                      >
                        Email{" "}
                        {sortConfig.key === "emailId" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>

                  <th className="border p-2 text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("program")}
                        className="flex justify-center"
                      >
                        PROGRAM{" "}
                        {sortConfig.key === "program" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>

                  <th className="border p-2 text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("department")}
                        className="flex justify-center"
                      >
                        DEPARTMENT{" "}
                        {sortConfig.key === "department" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>
                  {currentRound !== 1 && (
                    <>
                      <th className="border p-2 text-center">
                        <button
                          onClick={() => handleSort("cgpa")}
                          className="flex justify-center"
                        >
                          CGPA{" "}
                          {sortConfig.key === "cgpa" &&
                            (sortConfig.direction === "ascending" ? (
                              <AiOutlineSortAscending />
                            ) : (
                              <AiOutlineSortDescending />
                            ))}
                        </button>
                      </th>
                      <th className="border p-2 text-center">Grade</th>
                      <th className="border p-2 text-center">
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleSort("preference")}
                            className="flex justify-center"
                          >
                            Preference{" "}
                            {sortConfig.key === "preference" &&
                              (sortConfig.direction === "ascending" ? (
                                <AiOutlineSortAscending />
                              ) : (
                                <AiOutlineSortDescending />
                              ))}
                          </button>
                        </div>
                      </th>
                    </>
                  )}
                  <th className="border p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => renderAllocatedRow(student))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allocated === 0 && (
        <div className="m-5">
          {renderCommonHeader(
            "Available Students",
            currentRound,
            handlePrefFilter
          )}

          <div className="overflow-auto">
            <table className="w-full border-collapse border ">
              <thead className="sticky top-0">
                <tr className="bg-gray-200 text-gray-700 ">
                  <th className="border p-2 text-center ">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("name")}
                        className="flex justify-center"
                      >
                        Name{" "}
                        {sortConfig.key === "name" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>

                  <th className="border p-2 text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("emailId")}
                        className="flex justify-center"
                      >
                        Email{" "}
                        {sortConfig.key === "emailId" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>

                  <th className="border p-2 text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("program")}
                        className="flex justify-center"
                      >
                        PROGRAM{" "}
                        {sortConfig.key === "program" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>

                  <th className="border p-2 text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("department")}
                        className="flex justify-center"
                      >
                        DEPARTMENT{" "}
                        {sortConfig.key === "department" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>
                  {currentRound !== 1 && (
                    <>
                      <th className="border p-2 text-center">
                        <button
                          onClick={() => handleSort("cgpa")}
                          className="flex justify-center"
                        >
                          CGPA{" "}
                          {sortConfig.key === "cgpa" &&
                            (sortConfig.direction === "ascending" ? (
                              <AiOutlineSortAscending />
                            ) : (
                              <AiOutlineSortDescending />
                            ))}
                        </button>
                      </th>
                      <th className="border p-2 text-center">Grade</th>
                      <th className="border p-2 text-center">
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleSort("preference")}
                            className="flex justify-center"
                          >
                            Preference{" "}
                            {sortConfig.key === "preference" &&
                              (sortConfig.direction === "ascending" ? (
                                <AiOutlineSortAscending />
                              ) : (
                                <AiOutlineSortDescending />
                              ))}
                          </button>
                        </div>
                      </th>
                    </>
                  )}
                  <th className="border p-2 ">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => renderAvailableRow(student))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allocated === 2 && (
        <div className="m-5">
          <div className="flex">
            <h2 className="text-2xl font-bold mb-2 mr-2">
              Allocated Students to other courses
            </h2>
            {currentRound !== 1 && (
              <div className="mb-1 mr-2">
                <h2 className="mt-2 mr-2 inline-block">Preference:</h2>
                <select
                  name=""
                  id=""
                  className="px-2 py-2 border border-[#3dafaa] rounded inline-block"
                  onChange={handlePrefFilter}
                >
                  <option value="All">All</option>
                  <option value="Dept Preference 1">Dept Preference 1</option>
                  <option value="Dept Preference 2">Dept Preference 2</option>
                  <option value="Other Preference 1">Other Preference 1</option>
                  <option value="Other Preference 2">Other Preference 2</option>
                  <option value="Other Preference 3">Other Preference 3</option>
                  <option value="Other Preference 4">Other Preference 4</option>
                  <option value="Other Preference 5">Other Preference 5</option>
                  <option value="Not Any">Not Any</option>
                </select>
              </div>
            )}
            <div className="mb-1 mr-2">
              <h2 className="mt-2 mr-2 inline-block">Program:</h2>
              <select
                name=""
                id=""
                className="px-2 py-2 border border-[#3dafaa] rounded inline-block"
                onChange={handleProgramFilter}
              >
                <option value="All">All</option>
                <option value="B.Tech 3rd Year">B.Tech 3rd Year</option>
                <option value="B.Tech 4th Year">B.Tech 4th Year</option>
                <option value="M.Tech 1th Year">M.Tech 1th Year</option>
                <option value="M.Tech 2nd Year">M.Tech 2nd Year</option>
                <option value="PhD">PhD</option>
              </select>
            </div>

            <div className="mb-1 mr-2">
              <h2 className="mt-2 mr-2 inline-block">Department:</h2>
              <select
                name=""
                id=""
                className="px-2 py-2 border border-[#3dafaa] rounded inline-block"
                onChange={handleDepartmentFilter}
              >
                <option value="All">All</option>
                <option value="CSE">CSE</option>
                <option value="CB">CB</option>
                <option value="Maths">Maths</option>
                <option value="HCD">HCD</option>
                <option value="ECE">ECE</option>
                <option value="SSH">SSH</option>
              </select>
            </div>
          </div>
          <div className="overflow-auto ">
            <table className="w-full border-collapse border">
              <thead className="sticky top-0">
                <tr className="bg-gray-200 text-gray-700 ">
                  <th className="border p-2 text-center ">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("name")}
                        className="flex justify-center"
                      >
                        Name{" "}
                        {sortConfig.key === "name" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>
                  <th className="border p-2 text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("emailId")}
                        className="flex justify-center"
                      >
                        Email{" "}
                        {sortConfig.key === "emailId" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>

                  <th className="border p-2 text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("program")}
                        className="flex justify-center"
                      >
                        PROGRAM{" "}
                        {sortConfig.key === "program" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>

                  <th className="border p-2 text-center">
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleSort("department")}
                        className="flex justify-center"
                      >
                        DEPARTMENT{" "}
                        {sortConfig.key === "department" &&
                          (sortConfig.direction === "ascending" ? (
                            <AiOutlineSortAscending />
                          ) : (
                            <AiOutlineSortDescending />
                          ))}
                      </button>
                    </div>
                  </th>
                  {currentRound !== 1 && (
                    <>
                      <th className="border p-2 text-center">
                        <button
                          onClick={() => handleSort("cgpa")}
                          className="flex justify-center"
                        >
                          CGPA{" "}
                          {sortConfig.key === "cgpa" &&
                            (sortConfig.direction === "ascending" ? (
                              <AiOutlineSortAscending />
                            ) : (
                              <AiOutlineSortDescending />
                            ))}
                        </button>
                      </th>
                      <th className="border p-2 text-center">Grade</th>
                      <th className="border p-2 text-center">
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleSort("preference")}
                            className="flex justify-center"
                          >
                            Preference{" "}
                            {sortConfig.key === "preference" &&
                              (sortConfig.direction === "ascending" ? (
                                <AiOutlineSortAscending />
                              ) : (
                                <AiOutlineSortDescending />
                              ))}
                          </button>
                        </div>
                      </th>
                    </>
                  )}
                  <th className="border p-2">Allocated To</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) =>
                  renderAllocatedToOthers(student)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursePage;
