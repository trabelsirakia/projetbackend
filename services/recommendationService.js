const axios = require('axios');
const cheerio = require('cheerio');

const scrapeRecommendedCourses = async (searchQuery) => {
    try {
        const url = `https://www.coursera.org/search?query=${encodeURIComponent(searchQuery)}`;
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(data);
        const courses = [];

        $('h3').each((index, element) => {
            const title = $(element).text().trim();
            if (title.length > 10 && title.length < 100) { 
                courses.push({
                    title: title,
                    provider: "Coursera",
                    link: "https://www.coursera.org"
                });
            }
        });

        return courses.slice(0, 5);

    } catch (error) {
        console.error("Erreur lors du scraping :", error.message);
        return [
            { title: `Cours recommandé en ${searchQuery} (Simulation)`, provider: "TalentWave", link: "#" },
            { title: `Introduction avancée à ${searchQuery}`, provider: "TalentWave", link: "#" }
        ];
    }
};

module.exports = { scrapeRecommendedCourses };