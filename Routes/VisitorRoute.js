import express from "express";
import con from "../utils/db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import OpenAI from "openai";
import ElevenLabs from "elevenlabs-node";
import { exec } from "child_process";
import { promises as fs } from "fs";

const router = express.Router();
dotenv.config();

router.post("/visitor_login", (req, res) => {
  const sql = "SELECT * from visitor Where username = ? and password = ?";
  con.query(sql, [req.body.username, req.body.password], (err, result) => {
    if (err) return res.json({ loginStatus: false, Error: "Query error" });
    if (result.length > 0) {
      const query = "INSERT INTO visitor_logins (visitorID) VALUES (?)";
      con.query(query, [result[0].visitorID], (err, results) => {
        if (err) return res.json({ loginStatus: false, Error: "Query error" });
        const username = result[0].username;
        const token = jwt.sign(
          {
            role: "visitor",
            username: username,
            visitorID: result[0].visitorID,
          },
          "jwt_secret_key",
          { expiresIn: "1d" }
        );
        res.cookie("token", token);
        return res.json({ loginStatus: true, visitorID: result[0].visitorID });
      });
    } else {
      return res.json({
        loginStatus: false,
        Error: "Wrong username or password",
      });
    }
  });
});

router.post("/set_instructed/", (req, res) => {
  const { visitorID } = req.body;
  const query = "INSERT INTO visitor_instructed (visitorID) VALUES (?)";
  con.query(query, [visitorID], (err, results) => {
    if (err) return res.json({ Status: false, Error: "Query error" });
    return res.json({ Status: true, Result: results });
  });
});

router.get("/get_instructed", (req, res) => {
  const sql = "SELECT * FROM visitor_instructed";
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/detail/:visitorID", (req, res) => {
  const visitorID = req.params.visitorID;
  const sql = "SELECT * FROM visitor WHERE visitorID = ?";
  con.query(sql, [visitorID], (err, result) => {
    if (err) return res.json({ Status: false });
    // Get rewardpoints
    const sqlRewardPoint = "SELECT * FROM reward_points WHERE visitorID = ?";
    con.query(sqlRewardPoint, [visitorID], (err, rewardPoint) => {
      if (err) throw err;
      result[0].rewardPoints = rewardPoint[0].totalPoints;
      return res.json({ Status: true, Result: result });
    });
  });
});

// Edit rewardpoints
router.put("/edit_visitor/:visitorID", (req, res) => {
  const visitorID = req.params.visitorID;
  const sql = `UPDATE reward_points set totalPoints = ? Where visitorID = ?`;
  const totalPoints = req.body.rewardPoints;
  const values = [totalPoints];
  con.query(sql, [...values, visitorID], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });
    return res.json({ Status: true, Result: result });
  });
});

// Get rewardpoints
router.get("/rewardPoints", (req, res) => {
  const sql = "SELECT * FROM reward_points ORDER BY totalPoints DESC";
  con.query(sql, (err, rewardPoints) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    const results = [];

    // Get username
    rewardPoints.forEach((rewardPoint) => {
      const visitorID = rewardPoint.visitorID;
      const sqlUsername = "SELECT * FROM visitor WHERE visitorID = ?";
      con.query(sqlUsername, [visitorID], (err, visitor) => {
        if (err) return res.json({ Status: false, Error: "Query Error" });
        rewardPoint.username = visitor[0].username;
        results.push(rewardPoint);

        if (results.length === rewardPoints.length) {
          return res.json({ Status: true, Result: results });
        }
      });
    });
  });
});

router.get("/nb", (req, res) => {
  const sql = "SELECT * FROM notablebatangueños";
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/nb/:nbID", (req, res) => {
  const nbID = req.params.nbID;
  const sql = "SELECT * FROM notablebatangueños WHERE nbID = ?";
  con.query(sql, [nbID], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ Status: true });
});

// Pre-Trained Model
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Text-To-Speech
const voice = new ElevenLabs({
  apiKey: process.env.ELEVENLABS_API_KEY, // Your API key from Elevenlabs
});

router.post("/chat_nb", async (req, res) => {
  const { prompt, nb, visitorID, chat } = req.body;
  try {
    // Analyse message and get response
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: prompt,
      temperature: 1,
      max_tokens: 100,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    // Transcribe the text response to audio
    const fileName = "Public/Audios/message_audio.mp3";
    const message = completion.choices[0].message.content; // The text to convert to speech

    //_____________________TURN OFF ELEVENLABS HERE___________________________

    await voice.textToSpeech({
      fileName: fileName, // The name of your audio file
      textInput: message, // The text you wish to convert to speech
      voiceId: nb.voiceID, // A Voice ID from Elevenlabs
      stability: 0.5, // The stability for the converted speech
      similarityBoost: 0.5, // The similarity boost for the converted speech
      modelId: "eleven_multilingual_v2", // The ElevenLabs Model ID
      style: 1, // The style exaggeration for the converted speech
      speakerBoost: true, // The speaker boost for the converted speech
    });

    //_____________________________ENDS HERE___________________________________

    // generate lipsync
    await lipSyncMessage();
    const audio = await audioFileToBase64(fileName);
    const lipsync = await readJsonTranscript(
      `Public/Audios/message_audio.json`
    );
    const response = { message: message, audio: audio, lipsync: lipsync };

    const query =
      "INSERT INTO visitor_chats (visitorID, chat, nb, response) VALUES (?, ?, ?, ?)";
    con.query(query, [visitorID, chat, nb.name, message], (err, results) => {
      if (err) return console.log("error");
      res.send(response);
    });
  } catch (err) {
    res.status(500).send(err);
  }
});

// For NB speaking pattern
const lipSyncMessage = async () => {
  await execCommand(
    "ffmpeg -y -i Public\\Audios\\message_audio.mp3 Public\\Audios\\message_audio.wav"
    // -y to overwrite the file
  );
  await execCommand(
    ".\\bin\\rhubarb.exe -f json -o Public\\Audios\\message_audio.json Public\\Audios\\message_audio.wav -r phonetic"
  );
  // -r phonetic is faster but less accurate
};

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

// To get the question with choices
router.get("/questions", (req, res) => {
  //Get question
  const sqlAssessment = "SELECT * FROM assessment";
  con.query(sqlAssessment, (err, questions) => {
    if (err) throw err;

    const results = [];
    // Get choices
    questions.forEach((question) => {
      const sqlChoices =
        "SELECT * FROM question_choices WHERE assessmentID = ?";
      con.query(sqlChoices, [question.assessmentID], (err, choices) => {
        if (err) throw err;
        question.choices = choices;
        results.push(question);
        if (results.length === questions.length) {
          res.json(results);
        }
      });
    });
  });
});

// Add a feedback
router.post("/feedback", (req, res) => {
  const { visitorID, feedback } = req.body;

  con.query(
    "INSERT INTO feedback (visitorID, feedback) VALUES (?, ?)",
    [visitorID, feedback],
    (err, result) => {
      if (err) return res.json({ Status: false, Error: "Query Error" + err });
      return res.json({ Status: true, Result: result });
    }
  );
});

export { router as visitorRouter };
