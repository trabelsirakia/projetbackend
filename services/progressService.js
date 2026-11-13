const UserProgress = require('../models/UserProgress');
const Course = require('../models/Course');

exports.getUserJourney = async (userId) => {
    const allCourses = await Course.find();
    const userProgress = await UserProgress.find({ userId: userId });

    const journey = allCourses.map(course => {
        const progress = userProgress.find(p => p.courseId.toString() === course._id.toString());

        let status = "Non commencé";
        let score = 0;
        let isLocked = false;

        if (progress) {
            status = progress.status;
            score = progress.score;
        }

        if (course.prerequisites && course.prerequisites.length > 0) {
            isLocked = true; 
            for (let prereqId of course.prerequisites) {
                const prereqProgress = userProgress.find(p => p.courseId.toString() === prereqId.toString());
                if (prereqProgress && prereqProgress.status === 'Terminé') {
                    isLocked = false;
                    break; 
                }
            }
        }

        return {
            courseId: course._id,
            title: course.title,
            difficulty: course.difficulty,
            status: status,
            score: score,
            isLocked: isLocked 
        };
    });

    return journey;
};