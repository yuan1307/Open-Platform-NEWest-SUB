
import { GoogleGenAI, Type } from "@google/genai";
import { QuizQuestion } from "../types";

const TEACHER_INSTRUCTION = `
You are an expert AI Instructional Design Assistant embedded within a professional Teacher Portal. Your goal is to support educators by reducing administrative workload, enhancing lesson creativity, and providing pedagogically sound resources.

**I. Core Identity & Behavior**
* **Role:** You are a collaborative partner, not just a search engine. You think like a veteran teacher: practical, empathetic, and focused on student outcomes.
* **Tone:** Professional, encouraging, objective, and efficient.
* **Pedagogy:** You prioritize active learning, differentiation, and clear learning objectives. You utilize frameworks like Bloom’s Taxonomy and Universal Design for Learning (UDL) implicitly in your responses.

**II. Response Guidelines**
1.  **Structure is Key:** Teachers are busy. Avoid walls of text. Use headings, bullet points, and tables to make content scannable.
2.  **Curriculum Alignment:** If the user provides a specific curriculum standard (e.g., Common Core, NGSS, IB), align your content strictly to it. If none is provided, aim for generally accepted global standards for that subject/grade.
3.  **Differentiation:** When creating content, automatically consider diverse learners. Where appropriate, suggest modifications for:
    * Advanced learners (Extension).
    * Struggling learners (Scaffolding).
    * ELL/ESL students.
4.  **Accuracy:** If asked for facts, ensure high accuracy. If a topic is controversial or subject to debate, present multiple viewpoints objectively.

**III. Task-Specific Instructions**

* **When asked for Lesson Plans:**
    * Include: Topic, Grade Level, Learning Objectives (SWBAT), Materials Needed, Warm-up, Direct Instruction, Guided Practice, Independent Practice, and Closure.
    * Always suggest a "Check for Understanding" method.

* **When asked for Rubrics:**
    * Present them in a Markdown Table.
    * Include clear criteria (rows) and proficiency levels (columns: e.g., Emerging, Developing, Proficient, Mastery).

* **When asked for Quizzes/Assessments:**
    * Provide the questions clearly.
    * Provide an Answer Key at the very bottom (separated by a horizontal rule).
    * Suggest common misconceptions students might have for specific questions.

* **When asked for Communication (Emails/Letters):**
    * Draft clearly and professionally.
    * Use placeholders like \`[Student Name]\` or \`[Date]\` for easy customization.
    * Keep the tone supportive and solution-oriented.

**IV. Constraints & Safety**
* **No PII:** Do not ask for or store personally identifiable information (PII) regarding students. If a teacher pastes PII, remind them gently to anonymize data.
* **Academic Integrity:** Do not generate full essays for students to submit as their own work. If asked, provide outlines, samples for analysis, or feedback.
* **Math & Science:** Use LaTeX formatting with **$** delimiters for inline math (e.g., $a^2+b^2=c^2$) and **$$** for block math to ensure they render correctly in the portal.

**V. Formatting Toolkit**
* Use \`###\` for major section headers.
* Use \`**bold**\` for key terms or vocabulary.
* Use \`---\` to separate teacher notes from student-facing content.
`;

const STUDENT_INSTRUCTION = `
You are a friendly, encouraging, and highly knowledgeable AI Tutor. Your goal is to help students learn concepts deeply, not just give them the answers.

**I. Core Identity & Behavior**
* **Role:** Socratic Tutor. You guide students to the answer through questions and hints.
* **Tone:** Supportive, patient, and enthusiastic. Use emojis occasionally to keep it friendly.
* **Method:** Never give the direct answer immediately (unless it's a simple factual query). Ask leading questions to check understanding.

**II. Response Guidelines**
1.  **Scaffold Learning:** Break complex problems down into smaller steps.
2.  **Check for Understanding:** After explaining a concept, ask the student a question to see if they got it.
3.  **Encourage Growth:** If a student gets it wrong, be gentle. "Not quite, but you're on the right track! Think about..."
4.  **Formatting:** Use bolding for key terms. Use LaTeX for math ($...$ for inline, $$...$$ for blocks).

**III. Constraints**
* Do not write full essays for students.
* Do not solve homework problems instantly without student effort.
`;

const SCHEDULE_PARSER_INSTRUCTION = `
You are a data entry assistant. Your task is to extract a weekly class schedule from an image.
The school day has exactly 8 periods, indexed 0 to 7.
Days are: Mon, Tue, Wed, Thu, Fri.

Rules for extraction:
1. Extract the Day, Subject, Teacher Name, and Room Number.
2. **Filtering & Indexing (CRITICAL)**:
   - **EXCLUDE** the following items entirely (do not output them): "AE", "Academic Enrichment", "Lunch", "Assembly", "Evening Enrichment Program".
   - **Sequence**: Identify the valid academic classes. Assign them Period Indices 0 through 7 sequentially.
   - **Gap Logic**: 
     - The standard schedule has a break around 11:30-12:40 for Lunch and AE. **DO NOT** count this break as a "Free Period". **DO NOT** skip an index for this break. 
     - Example: If Period 3 ends at 11:35 and Period 4 starts at 12:40, they are consecutive. Period 4 is index 4.
     - Only skip an index (assign a Free Period) if there is a significant gap (e.g., > 60 mins) that is **NOT** the standard Lunch/AE block.
3. If a teacher's name is partial (e.g. "Smith" instead of "John Smith"), just extract "Smith".
4. Return JSON only.
`;

export const getTutorResponse = async (
  history: { role: 'user' | 'model', text: string }[], 
  message: string,
  file?: { mimeType: string, data: string },
  mode: 'student' | 'teacher' = 'teacher'
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = mode === 'teacher' ? TEACHER_INSTRUCTION : STUDENT_INSTRUCTION;

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction,
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });

    const parts: any[] = [{ text: message }];
    if (file) {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    }

    const result = await chat.sendMessage({ message: parts });
    return result.text || "I'm having trouble thinking right now. Try again?";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I am currently offline or experiencing issues. Please check your connection.";
  }
};

export const parseScheduleFromImage = async (
  base64Data: string, 
  mimeType: string
): Promise<Array<{ day: string, periodIndex: number, subject: string, teacher: string, room: string }>> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: "Extract the schedule from this image into a JSON list of objects. Each object must have: day (Mon, Tue, Wed, Thu, Fri), periodIndex (integer 0-7), subject, teacher, room."
          }
        ]
      },
      config: {
        systemInstruction: SCHEDULE_PARSER_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.STRING },
              periodIndex: { type: Type.INTEGER },
              subject: { type: Type.STRING },
              teacher: { type: Type.STRING },
              room: { type: Type.STRING },
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Schedule Parse Error:", error);
    throw new Error("Failed to analyze schedule image.");
  }
};

export const checkContentSafety = async (text: string): Promise<{ isSafe: boolean; reason?: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the following text for profanity, hate speech, severe bullying, self-harm promotion, or sexually explicit content suitable for a K-12 school environment. 
      
      Text: "${text}"
      
      Respond with JSON only: { "isSafe": boolean, "reason": "short explanation if unsafe, otherwise null" }`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return { isSafe: true }; 
  } catch (error) {
    console.error("Content Check Error:", error);
    return { isSafe: true };
  }
};

// --- Teacher Tool Functions ---

export const generateRubric = async (
    subject: string, 
    grade: string, 
    assignment: string, 
    file?: { mimeType: string, data: string }
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [
            { text: `Create a detailed grading rubric for a ${grade} ${subject} assignment titled "${assignment}". 
            Output ONLY a Markdown Table. Columns: Criteria, Emerging, Developing, Proficient, Mastery.
            ${file ? 'Reference the attached file content for specific criteria where applicable.' : ''}` }
        ];
        
        if (file) {
            parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                systemInstruction: TEACHER_INSTRUCTION,
            }
        });
        return response.text || "Failed to generate rubric.";
    } catch (e) {
        console.error("Rubric Gen Error", e);
        return "Error creating rubric.";
    }
};

export const generateEmail = async (
    studentName: string, 
    issue: string, 
    tone: string,
    file?: { mimeType: string, data: string }
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [
            { text: `Draft a professional email to the parents of ${studentName}.
            Topic: ${issue}.
            Tone: ${tone}.
            Keep it concise, supportive, and action-oriented.
            ${file ? 'Incorporate context from the attached file (e.g. specific incident report, grades, or work sample) if relevant.' : ''}` }
        ];

        if (file) {
            parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                systemInstruction: TEACHER_INSTRUCTION,
            }
        });
        return response.text || "Failed to draft email.";
    } catch (e) {
        console.error("Email Gen Error", e);
        return "Error drafting email.";
    }
};

export const generateQuiz = async (
    topic: string,
    file?: { mimeType: string, data: string }
): Promise<QuizQuestion[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [
            { text: `Generate a 5-question multiple choice quiz about: "${topic}".
            ${file ? 'Base the questions primarily on the content of the attached file.' : ''}
            Ensure one option is clearly correct.
            Return JSON only.` }
        ];

        if (file) {
            parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            answer: { type: Type.STRING, description: "The correct option string, must match exactly one of the options." }
                        }
                    }
                }
            }
        });
        
        if (response.text) {
            return JSON.parse(response.text);
        }
        return [];
    } catch (e) {
        console.error("Quiz Gen Error", e);
        return [];
    }
};

// --- Student Tool Functions ---

export const generateFlashcards = async (
    topic: string,
    file?: { mimeType: string, data: string }
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [
            { text: `Create a set of 10 high-quality study flashcards for the topic: "${topic}".
            ${file ? 'Base the flashcards primarily on the content of the attached file.' : ''}
            Format the output ONLY as a Markdown table with two columns: "Front (Question/Term)" and "Back (Answer/Definition)".
            Do not include introductory text.` }
        ];

        if (file) {
            parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                systemInstruction: "You are a helpful study assistant. Your goal is to create effective revision materials.",
            }
        });
        return response.text || "Failed to generate flashcards.";
    } catch (e) {
        console.error("Flashcard Gen Error", e);
        return "Error creating flashcards.";
    }
};

export const simplifyConcept = async (
    concept: string,
    file?: { mimeType: string, data: string }
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const parts: any[] = [
            { text: `Explain the following concept like I am 5 years old (ELI5): "${concept}".
            ${file ? 'Use the attached file as context for the explanation.' : ''}
            Use simple analogies, clear language, and maybe a fun example. Break it down step-by-step.` }
        ];

        if (file) {
            parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                systemInstruction: "You are a helpful tutor who is great at simplifying complex topics using analogies.",
            }
        });
        return response.text || "Failed to simplify concept.";
    } catch (e) {
        console.error("Simplifier Error", e);
        return "Error simplifying concept.";
    }
};
