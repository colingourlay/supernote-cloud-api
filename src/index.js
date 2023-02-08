import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { md5Of, sha256Of } from "./util.js";

const API_ENDPOINT = "https://cloud.supernote.com/api/";
const COMMON_POST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36",
  "Content-Type": "application/json",
};

async function post(url, payload, token, customHeaders = {}) {
  const headers = {
    ...COMMON_POST_HEADERS,
    ...customHeaders,
  };

  if (token) {
    headers["x-access-token"] = token;
  }

  const response = await fetch(`${API_ENDPOINT}${url}`, {
    method: "post",
    headers,
    body: JSON.stringify(payload),
  });

  return await response.json();
}

async function getRandomCode(email) {
  const { randomCode, timestamp } = await post(
    "official/user/query/random/code",
    { countryCode: "93", account: email }
  );

  return { randomCode, timestamp };
}

async function getAccessToken(email, password, randomCode, timestamp) {
  const data = await post("official/user/account/login/new", {
    countryCode: "93",
    browser: "Chrome107",
    equipment: "1",
    loginMethod: "1",
    language: "en",
    account: email,
    password: sha256Of(md5Of(password) + randomCode),
    timestamp: timestamp,
  });

  return data.token;
}

/**
 * Login to SuperNote Cloud API.
 * @async
 * @param {string} email User e-mail address
 * @param {string} password User password
 * @return {Promise<string>} Access token to access storage
 */
export async function login(email, password) {
  const { randomCode, timestamp } = await getRandomCode(email);

  return await getAccessToken(email, password, randomCode, timestamp);
}

/**
 * Return contents of folder.
 * @async
 * @param {string} token Access token from login()
 * @param {string?} directoryId Identifier of folder to list (default is root folder)
 * @return {Promise<FileInfo>} List of files and folders.
 */
export async function fileList(token, directoryId = "0") {
  const data = await post(
    "file/list/query",
    {
      directoryId,
      pageNo: 1,
      pageSize: 100,
      order: "time",
      sequence: "desc",
    },
    token
  );

  return data.userFileVOList;
}

/**
 * Upload a file.
 * @async
 * @param {string} token Access token from login()
 * @param {string} filePath Absolute path of file in local filesystem
 * @param {string?} directoryId Identifier of folder to upload to (default is root folder)
 * @return {Promise<boolean>} Success
 */
export async function uploadFile(token, filePath, directoryId = "0") {
  const fileName = basename(filePath);
  const { size } = statSync(filePath);
  const fileData = readFileSync(filePath);
  const md5 = md5Of(fileData);
  const timestamp = `${Date.now()}`;

  const applyResponseData = await post(
    "file/upload/apply",
    {
      directoryId,
      fileName,
      md5,
      size,
    },
    token,
    {
      nonce: `${Math.floor(Math.random() * 10)}${timestamp}`,
      timestamp,
    }
  );

  const { success, url, s3Authorization, xamzDate } = applyResponseData;
  const innerName = basename(url);

  if (success) {
    await fetch(url, {
      method: "put",
      headers: {
        Authorization: s3Authorization,
        "x-amz-date": xamzDate,
        "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      },
      body: fileData,
    });
  }

  const finishResponseData = await post(
    "file/upload/finish",
    {
      directoryId,
      fileName,
      fileSize: size,
      innerName,
      md5,
    },
    token
  );

  return finishResponseData.success;
}
