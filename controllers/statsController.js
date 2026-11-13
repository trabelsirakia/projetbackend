const Course = require('../models/Course');
const Certification = require('../models/Certification');
const UserProgress = require('../models/UserProgress');
const AntiCheatLog = require('../models/AntiCheatLog');

exports.getGlobalStats = async (req, res) => {
    try {
        const totalCourses = await Course.countDocuments();
        const totalTests = await Certification.countDocuments();
        const totalCertified = await UserProgress.countDocuments({ isCertified: true });
        const totalCheatingAlerts = await AntiCheatLog.countDocuments({ status: 'Suspect' });

        res.status(200).json({
            message: "Statistiques globales de TalentWave",
            data: {
                totalCourses: totalCourses,
                totalTests: totalTests,
                totalCertificationsValidees: totalCertified,
                alertesTriche: totalCheatingAlerts
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};