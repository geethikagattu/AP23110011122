const axios = require("axios");

// Simple script to make API requests for testing
async function makeRequests() {
  const baseURL = "http://localhost:5000/api/v1/notifications";

  const requests = [
    {
      method: "POST",
      url: baseURL,
      data: {
        userId: "user-123",
        type: "placement",
        title: "Job Offer from Tech Corp",
        message:
          "Congratulations! You have received a job offer from Tech Corp for the Software Engineer position with a salary of 12 LPA.",
        priority: "urgent",
        metadata: {
          companyName: "Tech Corp",
          salary: "12 LPA",
          position: "Software Engineer",
        },
      },
    },
    {
      method: "POST",
      url: baseURL,
      data: {
        userId: "user-456",
        type: "interview",
        title: "Interview Scheduled with Google",
        message:
          "Your technical interview with Google is scheduled for tomorrow at 2 PM. Please be prepared with your resume and portfolio.",
        priority: "high",
        metadata: {
          companyName: "Google",
          date: "2026-05-03",
          time: "2:00 PM",
          round: "Technical Round 1",
        },
      },
    },
    {
      method: "POST",
      url: baseURL,
      data: {
        userId: "user-789",
        type: "event",
        title: "Microsoft Placement Drive",
        message:
          "Microsoft placement drive scheduled for next week. All eligible students are requested to register through the placement portal.",
        priority: "medium",
        metadata: {
          companyName: "Microsoft",
          date: "2026-05-10",
          venue: "Main Auditorium",
          registrationDeadline: "2026-05-05",
        },
      },
    },
    {
      method: "GET",
      url: `${baseURL}/user-123?page=1&limit=10`,
    },
    {
      method: "GET",
      url: `${baseURL}/user-123/priority-inbox?limit=5`,
    },
  ];

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    try {
      console.log(`\n=== Request ${i + 1} ===`);
      console.log(`${req.method} ${req.url}`);
      if (req.data) {
        console.log("Body:", JSON.stringify(req.data, null, 2));
      }

      const response = await axios(req);
      console.log("\nResponse:");
      console.log("Status:", response.status);
      console.log("Data:", JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log("\nError:");
      if (error.response) {
        console.log("Status:", error.response.status);
        console.log("Data:", JSON.stringify(error.response.data, null, 2));
      } else {
        console.log("Message:", error.message);
      }
    }

    // Wait 1 second between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

makeRequests().catch(console.error);
