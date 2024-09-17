import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import renderCard from "../../src/renderCard";
import { isSnowflake } from "../../src/snowflake";
import redis from "../../src/redis";
import JSONbig from "json-bigint";

type Data = {
    id?: string | string[];
    error?: any;
    code?: string;
};

type Parameters = {
    theme?: string;
    bg?: string;
    hideStatus?: string;
    hideTimestamp?: string;
    hideDiscrim?: string;
    borderRadius?: string;
    animated?: string;
};

const convertBigIntToString = (obj: { [key: string]: any }): { [key: string]: any } => {
    const result: { [key: string]: any } = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        if (typeof obj[key] === "bigint") {
            result[key] = obj[key].toString();
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
            result[key] = convertBigIntToString(obj[key]);
        } else {
            result[key] = obj[key];
        }
    }

    return result;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
    let getUser: any = {};

    if (!req.query.id)
        return res.send({
            error: `No ID provided.`,
        });

    const params: Parameters = req.query,
        userId = req.query.id[0];

    if (!isSnowflake(userId))
        return res.send({
            error: `That is not a valid snowflake ID!`,
        });

    try {
        getUser.data = await fetch(`https://api.lanyard.rest/v1/users/${userId}`)
            .then(res => res.text())
            .then(res => convertBigIntToString(JSONbig.parse(res)));
    } catch (error: any) {
        if (error.response.data && error.response.data.error.message)
            return res
                .status(404)
                .send({ error: error.response.data.error.message, code: error.response.data.error.code });

        if (error.response.status === 404) return res.status(404).send({ error: "Invalid user!" });

        console.log(error); // Only console log the error if its not a 404

        return res.status(400).send({
            error: `Something went wrong! If everything looks correct and this still occurs, please contact @notcnrad on Twitter.`,
        });
    }

    try {
        let user = await redis.hget("users", userId);
        if (!user) await redis.hset("users", userId, "true");
    } catch {
        null;
    }

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("content-security-policy", "default-src 'none'; img-src * data:; style-src 'unsafe-inline'");

    const svg = await renderCard(getUser.data, params);
    res.status(200).send(svg as any);
}
