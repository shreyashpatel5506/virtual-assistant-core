import dns from "dns/promises";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import bcrypt from "bcryptjs"; // Ensure bcrypt is imported correctly
import { generateToken, verifyToken } from "./token.js"; // Import the token generation function
import User from "../models/user.model.js";
import uploadOnCloudinary from './../config/cloudinary.js';
import geminiResponse from "../gemini.js";
import { storehistory } from "./history.controller.js";
import moment from "moment";
import axios from "axios";
dotenv.config();


const otpStorage = new Map();

export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required", success: false });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(422).json({ message: "Invalid email format", success: false });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          email: process.env.BREVO_SENDER,
          name: "Virtual Assistant",
        },
        to: [{ email }],
        subject: "🔐 Your OTP Code",
        htmlContent: `
          <h2>Your OTP is ${otp}</h2>
          <p>This OTP is valid for 10 minutes.</p>
        `,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    otpStorage.set(email, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return res.status(200).json({ message: "OTP sent", success: true });

  } catch (error) {
    console.error("Brevo API OTP error:", error?.response?.data || error.message);
    return res.status(500).json({ message: "Failed to send OTP", success: false });
  }
};

export const verifyOTP = (req, res) => {
    const { email, otp } = req.body;
    const record = otpStorage.get(email);
    if (record && record.otp === otp) {
        otpStorage.set(email, { ...record, verified: true });
        return res.status(200).json({ message: "OTP verified", success: true });
    }
    return res.status(400).json({ message: "Invalid OTP", success: false });
};

export const signUP = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required", success: false });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(422).json({ message: "Invalid email format", success: false });
        }

        const record = otpStorage.get(email);
        if (!record || !record.verified) {
            return res.status(400).json({ message: "OTP not verified", success: false });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists", success: false });
        }

        if (password.length < 6) {
            return res.status(422).json({ message: "Password must be at least 6 characters", success: false });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });

        const token = generateToken(newUser);
        await newUser.save();

        if (record.verified) otpStorage.delete(email);

        res.cookie("token", token, {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 10 * 24 * 60 * 60 * 1000,
        });

        res.status(201).json({
            message: "User registered successfully",
            success: true,
            user: { id: newUser._id, name: newUser.name, email: newUser.email },
            token,
        });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Internal server error", success: false });
    }
};


export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required", success: false });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid password", success: false });
        }

        const token = generateToken(user);

        res.cookie("token", token, {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 10 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
            message: "Login successful",
            success: true,
            user: { id: user._id, name: user.name, email: user.email },
            token,
        });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error", success: false });
    }
};


export const passwordReset = async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ message: "Email and new password are required", success: false });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ message: "User not found", success: false });
    }

    if (newPassword.length < 6) {
        return res.status(422).json({ message: "Password must be at least 6 characters", success: false });
    }

    user.password = bcrypt.hashSync(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password reset successfully", success: true });
}


export const updateProfile = async (req, res) => {
    try {
        const { assistantName, assistantImage } = req.body;
        const userId = req.user.id; // now from JWT middleware

        if (!assistantName && !req.file && !assistantImage) {
            return res.status(400).json({
                message: "Assistant name and image are required",
                success: false,
            });
        }

        // Start with image from body, will override if file is uploaded
        let finalImage = assistantImage;

        if (req.file) {
            const uploaded = await uploadOnCloudinary(req.file);
            finalImage = uploaded?.url || uploaded; // handle object or string return
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { assistantName, assistantImage: finalImage },
            { new: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({
                message: "User not found",
                success: false,
            });
        }

        res.status(200).json({
            message: "Profile updated successfully",
            success: true,
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                assistantName: updatedUser.assistantName,
                assistantImage: updatedUser.assistantImage,
            },
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({
            message: "Internal server error",
            success: false,
        });
    }
};


export const getUserProfile = async (req, res) => {
    const userId = req.user.id; // Assuming user ID is stored in req.user

    try {
        const user = await User.findById(userId).select("-password"); // Exclude password from response
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        res.status(200).json({
            message: "User profile retrieved successfully",
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                assistantName: user.assistantName,
                assistantImage: user.assistantImage,
                history: user.history,
            },
        });
    } catch (error) {
        console.error("Error retrieving user profile:", error);
        res.status(500).json({ message: "Internal server error", success: false });
    }
}

export const logout = (req, res) => {
    res.clearCookie("token");
    res.status(200).json({ message: "Logged out successfully", success: true });
}


/**
 * Helper → Call external doc generation API (e.g. APITemplate.io)
 * Instead of saving files on backend.
 */
const generateDocWithAPI = async (content) => {
    try {
        const apiResponse = await axios.post(
            "https://api.apitemplate.io/v1/render",
            {
                template_id: process.env.APITEMPLATE_TEMPLATE_ID, // set in .env
                data: { content },
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.APITEMPLATE_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        return apiResponse?.data?.url || null; // Direct doc link
    } catch (err) {
        console.error("Doc generation error:", err.message);
        return null;
    }
};

const logAssistantHistory = async (req, assistantResponse, userMessage) => {
    try {
        const historyAction = [
            `User: ${userMessage}`,
            `Assistant: ${assistantResponse.response}`,
            assistantResponse.type ? `Type: ${assistantResponse.type}` : null,
        ]
            .filter(Boolean)
            .join(" | ");

        await storehistory(
            {
                user: req.user,
                body: { action: historyAction },
            },
            {
                status: () => ({
                    json: () => null,
                }),
            }
        );
    } catch (error) {
        console.error("Error storing assistant history:", error);
    }
};

export const askToAssistant = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const userMessage = req.body.message;
        const assistantName = user.assistantName;
        const authorName = user.name;
        let assistantResponse = null;

        const result = await geminiResponse(userMessage, assistantName, authorName);

        const jsonMatch = result.text.match(/{[\s\S]*}/);
        if (!jsonMatch) {
            assistantResponse = {
                response: "Sorry, I can't understand.",
            };
            await logAssistantHistory(req, assistantResponse, userMessage);
            return res.status(200).json(assistantResponse);
        }

        const gemResult = JSON.parse(jsonMatch[0]);
        const type = gemResult.type;

        switch (type) {
            /** ===================== GENERAL ===================== **/
            case "general":
            case "ai_chat":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: gemResult.response,
                };
                break;

            /** ===================== SEARCH & MEDIA ===================== **/
            case "google_search":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Searching Google for "${gemResult.userinput}"`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput
                    )}`,
                };
                break;

            case "youtube_search":
            case "youtube_play":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Searching YouTube for "${gemResult.userinput}"`,
                    actionUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
                        gemResult.userinput
                    )}`,
                };
                break;

            case "spotify_play":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Playing on Spotify: ${gemResult.userinput}`,
                    actionUrl: `https://open.spotify.com/search/${encodeURIComponent(
                        gemResult.userinput
                    )}`,
                };
                break;

            /** ===================== DATE & TIME ===================== **/
            case "get_time":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Current time is ${moment().format("HH:mm:ss")}`,
                };
                break;
            case "get_date":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Current date is ${moment().format("YYYY-MM-DD")}`,
                };
                break;
            case "get_day":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Today is ${moment().format("dddd")}`,
                };
                break;
            case "get_month":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Current month is ${moment().format("MMMM")}`,
                };
                break;

            /** ===================== TOOLS & APPS ===================== **/
            case "calculator_open":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: "Opening calculator",
                    actionUrl: "https://www.google.com/search?q=calculator",
                };
                break;

            case "calendar_open":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: "Opening calendar",
                    actionUrl: "https://calendar.google.com",
                };
                break;

            case "notes_open":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: "Opening notes app",
                    actionUrl: "https://keep.google.com", // example: Google Keep
                };
                break;

            case "reminder_set":
            case "alarm_set":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: gemResult.response,
                };
                break;

            /** ===================== SOCIAL MEDIA ===================== **/
            case "instagram_open":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: "Opening Instagram",
                    actionUrl: "https://instagram.com",
                };
                break;
            case "facebook_open":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: "Opening Facebook",
                    actionUrl: "https://facebook.com",
                };
                break;
            case "twitter_open":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: "Opening Twitter/X",
                    actionUrl: "https://twitter.com",
                };
                break;
            case "whatsapp_open":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: "Opening WhatsApp",
                    actionUrl: "https://web.whatsapp.com",
                };
                break;
            case "telegram_open":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: "Opening Telegram",
                    actionUrl: "https://web.telegram.org",
                };
                break;
            case "snapchat_open":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: "Opening Snapchat",
                    actionUrl: "https://www.snapchat.com",
                };
                break;
            case "linkedin_open":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: "Opening LinkedIn",
                    actionUrl: "https://linkedin.com",
                };
                break;

            /** ===================== WEATHER & LOCATION ===================== **/
            case "weather_show":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Fetching weather for ${gemResult.userinput}`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput + " weather"
                    )}`,
                };
                break;

            case "maps_open":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Opening maps for ${gemResult.userinput}`,
                    actionUrl: `https://www.google.com/maps/search/${encodeURIComponent(
                        gemResult.userinput
                    )}`,
                };
                break;

            case "location_share":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: "Sharing your current location",
                };
                break;

            /** ===================== SPORTS ===================== **/
            case "live_cricket_score":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Searching live cricket scores for "${gemResult.userinput}"`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput + " live cricket score"
                    )}`,
                };
                break;

            case "live_football_score":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Searching live football scores for "${gemResult.userinput}"`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput + " live football score"
                    )}`,
                };
                break;

            case "sports_news":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Fetching latest sports news for "${gemResult.userinput}"`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput + " sports news"
                    )}`,
                };
                break;

            /** ===================== NEWS & ENTERTAINMENT ===================== **/
            case "news_latest":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Fetching latest news`,
                    actionUrl: `https://news.google.com`,
                };
                break;

            case "movie_info":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Searching movie info for "${gemResult.userinput}"`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput + " movie"
                    )}`,
                };
                break;

            case "tv_show_info":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Searching TV show info for "${gemResult.userinput}"`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput + " TV show"
                    )}`,
                };
                break;

            case "celebrity_info":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Searching info about "${gemResult.userinput}"`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput
                    )}`,
                };
                break;

            /** ===================== UTILITIES ===================== **/
            case "translate_text":
            case "currency_convert":
            case "unit_convert":
            case "system_command":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Searching for ${type.replace("_", " ")}`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput
                    )}`,
                };
                break;

            /** ===================== FINANCE ===================== **/
            case "stock_price":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Fetching stock price for ${gemResult.userinput}`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput + " stock price"
                    )}`,
                };
                break;

            case "crypto_price":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Fetching crypto price for ${gemResult.userinput}`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput + " crypto price"
                    )}`,
                };
                break;

            case "finance_news":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Fetching latest finance news`,
                    actionUrl: `https://www.google.com/search?q=finance news`,
                };
                break;

            /** ===================== TRAVEL ===================== **/
            case "flight_status":
            case "book_flight":
            case "book_hotel":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Searching travel info for "${gemResult.userinput}"`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput
                    )}`,
                };
                break;

            /** ===================== COMMUNICATION ===================== **/
            case "send_email":
            case "send_sms":
            case "call_contact":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: gemResult.response,
                };
                break;

            /** ===================== AI TOOLS ===================== **/
            case "ai_image_generate":
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: `Generating image for "${gemResult.userinput}"`,
                    actionUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(
                        gemResult.userinput
                    )}`,
                };
                break;

            case "document_summarize":
            case "code_generate": {
                const docUrl = await generateDocWithAPI(gemResult.response);
                assistantResponse = {
                    type,
                    userInput: gemResult.userinput,
                    response: gemResult.response,
                    actionUrl: docUrl,
                };
                break;
            }

            /** ===================== DEFAULT ===================== **/
            default:
                assistantResponse = {
                    type: "google_search",
                    userInput: gemResult.userinput,
                    response: `Searching Google for "${gemResult.userinput}"`,
                    actionUrl: `https://www.google.com/search?q=${encodeURIComponent(
                        gemResult.userinput
                    )}`,
                };
        }

        await logAssistantHistory(req, assistantResponse, userMessage);
        return res.json(assistantResponse);
    } catch (error) {
        console.error("Error in askToAssistant:", error);
        res.status(500).json({ error: "Something went wrong" });
    }
};
