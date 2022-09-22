const hash = require("./hash");
const internalAPI = require("./authorise.js");
const pageDict = require("./page-dict.json");
const axios = require('axios').default;
const express = require("express");
const cookieParser = require('cookie-parser')
const fs = require("fs");
const EventEmitter = require("events");
const { URLSearchParams } = require("url");
const { send } = require("process");

const seshint = new internalAPI.sessions();

class pageLookup {
	static get(path, rcsdt)
	{
		for (var i = path.length; i > 0; i--)
		{
			var currpath = path.slice(0, i);
			if ((rcsdt ? rcsdt.lookup : pageDict)[currpath])
			{
				var currRes = (rcsdt ? rcsdt.lookup : pageDict)[currpath]
				if (typeof currRes == 'string')
					return {
						file: currRes,
						reqPerms: (currRes.reqPerms ? currRes.reqPerms : (rcsdt ? rcsdt.reqPerms : 0)) || 0
					};
				else (typeof currRes == 'object')
				{
					if (currpath.length == path.length && typeof currRes['/'] == 'string')
						return {
							file: currRes['/'],
							reqPerms: (currRes.reqPerms ? currRes.reqPerms : (rcsdt ? rcsdt.reqPerms : 0)) || 0
						};
					else
					{
						return this.get(path.slice(currpath.length),
							{
								lookup: currRes,
								reqPerms: (currRes.reqPerms ? currRes.reqPerms : (rcsdt ? rcsdt.reqPerms : 0)) || 0
							}
						);
					}
				}	
			}
		}
		return null;
	}
}

class web_worker extends EventEmitter
{
	constructor(port)
	{
		super();
		this.port = port || 3000;
		this.directory = `${__dirname}/pages/`;
		console.log("Starting WebServer");
		this.agent = express();
		this.agent.use(express.json());
		this.agent.use(cookieParser());
		this.agent.get("/static/*", (req, res) => {
			res.sendFile(this.directory+req.originalUrl, (err) => {
				res.status(404).send();
			});
		});

		this.agent.get("*", (req, res, next) => {
			if (req.headers['x-forwarded-proto'] == "http")
				res.status(101).redirect(`https://${req.headers['host']}${req.originalUrl}`);
			else if (req.path.length > 1 && req.path.at(-1) == "/")
			{
				var newret = req.originalUrl.split("");
				newret.splice(req.path.length - 1, 1);
				res.redirect(newret.join(""));
			}
			else
				next();
		});

		this.agent.get("/favicon.ico", (req, res) => { res.sendFile(`${this.directory}static/favicon.ico`, (err) => {if(err){ res.status(404).send(); console.log(err); }}); });

		this.agent.get("/login", (req, res) => {
			// Get AuthCode
			const params = new URLSearchParams();
			const state = `${hash(`${Math.random()}${hash(new Date().toDateString())}${Math.random()}`)}`;

			params.append("client_id", `${process.env['ft_client_id']}`);
			params.append("redirect_uri", `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['host']}/oauth/code`);
			params.append("scope", `public forum`);
			params.append("response_type", `code`);
			params.append("state", `${state}`);

			res.cookie("ft_state", `${state}`)
				.redirect(`https://api.intra.42.fr/oauth/authorize?${params.toString()}`);
		});

		this.agent.get("/design/test", (i, o) => {
			fs.readFile(`${this.directory}des-test.html`, (err, data) => {
				if (!err)
					o.send(data.toString());
				else
					o.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`);
			});
		});

		this.agent.get("/oauth", (i, o) => {o.redirect("/");});
		this.agent.get("/oauth/code", (i, o) => {
			const params = new URLSearchParams(i.originalUrl.slice(i.originalUrl.indexOf("?")));
			if (params.get("state") == i.cookies['ft_state'])
			{
				o.clearCookie("ft_state");
				if (params.get("code"))
				{
					o.status(200).cookie("ft_intra_code", params.get("code")).redirect("/oauth/token");
				}
				else
					o.status(401).redirect("/oauth/err?code=UNAUTHORISED");
			}
			else
				o.redirect("/oauth/err?code=BAD_STATE");
		});
		this.agent.get("/oauth/token", (i, o) => {
			if (i.cookies['ft_intra_code'])
			{
				const state = `${hash(`${Math.random()}${hash(new Date().toDateString())}${Math.random()}`)}`;
			
				axios.post("https://api.intra.42.fr/oauth/token", {
					"grant_type": `authorization_code`,
					"client_id": `${process.env['ft_client_id']}`,
					"client_secret": `${process.env['ft_client_secret']}`,
					"code": `${i.cookies['ft_intra_code']}`,
					"redirect_uri": `${i.headers['x-forwarded-proto'] || i.protocol}://${i.headers['host']}/oauth/code`,
					"state": `${state}`
				}).then((resp) => {
					if (resp.error)
					{
						console.log(resp.error);
						o.clearCookie("ft_intra_code");
						switch (data['error'])
						{
							case "invalid_grant":
								o.redirect(`/oauth/err?code=INVALID_GRANT`);
								break;
							default:
								o.redirect(`/oauth/err?code=DEV_SKILL_DIFF`);
								break;
						}
					}
					else
					{
						o.cookie("ft_intra_auth", resp.data['access_token']);
						seshint.createSession(resp.data['access_token']).then((sesh) => {
							o.cookie("ft_session", sesh.id);
							o.redirect("/panel");
						}).catch((err) => {
							o.redirect(`/oauth/err?code=${err.code}`);
						});
					}
				}).catch((err) => {
					console.log("axios:", err.message);
					o.redirect(`/oauth/err?code=DEV_SKILL_DIFF`);
				});
			}
			else
				o.redirect("/login");
		});
		this.agent.get("/oauth/err", (i, o) => {
			const params = new URLSearchParams(i.originalUrl.slice(i.originalUrl.indexOf("?")));
			var errorResponse = {};
			switch (params.get("code"))
			{
				case "BAD_STATE":
					errorResponse = {
						err: "BAD_STATE",
						message: "There is some miscommunication between Server and Client, Please open an issue if this persists.",
						allowRetry: true,
						allowIssue: true
					};
					break;
				case "INVALID_GRANT":
					errorResponse = {
						err: "INVALID_GRANT",
						message: "The grant provided from the server doesn't match what we believed.",
						allowRetry: true,
						allowIssue: true
					};
					break;
				case "UNAUTHORISED":
					errorResponse = {
						err: "UNAUTHORISED",
						message: "You will need to authorise ft-mentor to continue.",
						allowRetry: true,
						allowIssue: false
					};
					break;
				case "DEV_SKILL_DIFF":
					errorResponse = {
						err: "DEV_SKILL_DIFF",
						message: `We are sorry but our DEVs are being lazy. Please open an issue`,
						allowRetry: true,
						allowIssue: true
					};
					break;
				default:
					errorResponse = {
						err: "UNKNOWN",
						message: `The err code provided is invalid. Please open an issue`,
						allowRetry: true,
						allowIssue: true
					};
					break;
			}
			fs.readFile(`${this.directory}oauth/err.html`, (err, data) => {
				if (!err)
					o.send(data.toString().replace(/\{\{\s*([^}]+)\s*\}\}/g, (m, s) => {
						switch (s)
						{
							case "err:code": return (errorResponse.err || "DEV_SKILL_DIFF");
							case "err:message": return (errorResponse.message || "If you are seeing this, glhf!")
								.replace(/\n/g, "<br>")
								.replace(/(https:\/\/[^ ]+)/g, (m, l) => {
									return `<a href="${l}">${l}</a>`;
								});
							case "err:issue": return (errorResponse.allowIssue ? `<a href="https://github.com/IsCoffeeTho/ft-mentor/issues/new?title=${params.get("code")}+while+logging+in"><button class="btn-KO">Open Issue</button></a>` : "");
							case "err:retry": return (errorResponse.allowRetry ? `<a href="/login"><button class="btn-prim">Retry Login</button></a>` : "");
							default: return "";
						}
					}));
				else
					o.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`);
			});
		});

		this.agent.get("/oauth/*", (i, o) => {
			o.redirect("/");
		});

		this.agent.get("/err", (req, res) => {
			const params = new URLSearchParams(req.originalUrl.slice(req.originalUrl.indexOf("?")));
			var errorResponse = {};
			switch (params.get("code"))
			{
				case "NOT_MENTOR":
					errorResponse = {
						err: "NOT_MENTOR",
						message: `You lack the permissions to access this panel, check in with the bocal to add you to the mentor roster`,
						allowIssue: false
					};
					break;
				case "NOT_BOCAL":
					errorResponse = {
						err: "NOT_BOCAL",
						message: `You must be bocal to access this panel`,
						allowIssue: false
					};
					break;
				case "BAD_PERMS":
					errorResponse = {
						err: "BAD_PERMS",
						message: `You haven't been assigned as a mentor for your campus`,
						allowIssue: false
					};
					break;
				default:
					errorResponse = {
						err: "UNKNOWN",
						message: `The err code provided is invalid. Please open an issue`,
						allowIssue: true
					};
					break;
			}
			fs.readFile(`${this.directory}panel/err.html`, (err, data) => {
				if (!err)
					res.send(data.toString().replace(/\{\{\s*([^}]+)\s*\}\}/g, (m, s) => {
						switch (s)
						{
							case "err:code": return (errorResponse.err || "DEV_SKILL_DIFF");
							case "err:message": return (errorResponse.message || "If you are seeing this, glhf!")
							case "err:issue": return (errorResponse.allowIssue ? `<a href="https://github.com/IsCoffeeTho/ft-mentor/issues/new?title=${params.get("code")}+after+logging+in"><button class="btn-KO">Open Issue</button></a>` : "");
							default: return "";
						}
					}));
				else
					o.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`);
			});
		});
		this.agent.get("*", (req, res) => {
			var url = req.path;
			var lookup = pageLookup.get(url);
			if (lookup)
			{
				if (lookup.reqPerms > 0)
				{
					if (req.cookies['ft_intra_auth'])
					{
						var sesh = seshint.lookup(req.cookies['ft_session']);
						if (sesh)
						{
							if (sesh.user.permission >= lookup.reqPerms)
							{
								fs.readFile(`${this.directory}wrapper.html`, (err, wrp) => {
									if (!err)
									{
										fs.readFile(`${this.directory}${lookup.file}`, (err, data) => {
											if (err)
												return res.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`)
											res.status(200).cookie("ft_session", sesh.id).send(wrp.toString().replace("{{page}}", data.toString().replace(/\{\{\s{0,}([^}]+)\s{0,}\}\}/g, (m, g) => {
												switch (g)
												{
													case "intra:role": return `${sesh.user.role.toUpperCase()}`;
													case "intra:user": return `${sesh.user.login}`;
													case "intra:campus": return `${sesh.user.campus.name}`;
													default: return "&nbsp;";
												}
											})));
										});
									}
									else
										res.status().send(`500 Internal Server Error: ${err.code}`);
								});
							}
							else
							{
								if (lookup.reqPerms == 2)
									res.redirect("/err?code=NOT_BOCAL");
								else if (lookup.reqPerms == 1)
									res.redirect("/err?code=NOT_MENTOR");
							}
						}
						else
							res.redirect("/login");
					}
					else
					{
						res.redirect("/login");
					}
				}
				else
				{
					fs.readFile(`${this.directory}wrapper.html`, (err, wrp) => {
						if (!err)
						{
							fs.readFile(`${this.directory}${lookup.file}`, (err, data) => {
								if (err)
									return res.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`)
								res.status(200).send(wrp.toString().replace("{{page}}", data.toString().replace(/\{\{\s{0,}([^}]+)\s{0,}\}\}/g, (m, g) => {
									switch (g)
									{
										case "intra:role": return "STUDENT";
										case "intra:user": return "marvin";
										case "intra:campus": return "Paris";
										default: return "&nbsp;";
									}
								})));
							});
						}
						else
							res.status().send(`500 Internal Server Error: ${err.code}`);
					});
				}
			}
			else
			{
				res.status(404).sendFile(`${this.directory}404.html`, (err) => {
					if (err)
						res.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`);
				});
			}
		});

		try {
			this.agent.listen(this.port, () => {
				this.emit('ready');
			});
		}
		catch (e)
		{
			this.emit('fatal', e);
		}
	}
}

module.exports = web_worker;