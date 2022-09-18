class cookies
{
	static set(cname, cvalue, exdays)
	{
		const d = new Date();
		d.setTime(d.getTime() + (exdays*24*60*60*1000));
		let expires = "expires="+ d.toUTCString();
		document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
	}

	static get(cname, defaultvalue)
	{
		let name = cname + "=";
		let decodedCookie = decodeURIComponent(document.cookie);
		let ca = decodedCookie.split(';');
		for (let i = 0; i <ca.length; i++)
		{
			let c = ca[i];
			while (c.charAt(0) == ' ')
				c = c.substring(1);
			if (c.indexOf(name) == 0)
				return c.substring(name.length, c.length);
		}
		return defaultvalue || null;
	}
}

class cwapi
{	
	constructor()
	{
		this.user = {};
		console.debug("[CWAPI] Initialising application");
		window.onpopstate = (event) => {
			console.debug(`[CWAPI] page back action, navigating to ${document.location.pathname}`);
			fetch(`/app${document.location.pathname}`).then((data) => {
				data.text().then((resp) => { document.body.innerHTML = resp; });
			}).catch((err) => {
				console.log(err);
			});
		};
	}

	navigate(newlocation="", internal=true)
	{
		return new Promise((res, rej) => {
			if (typeof internal != "boolean")
				internal = true;
			console.debug(`[CWAPI] navigating to ${newlocation}`);
			window.history.pushState("", "", newlocation);
			if (!internal)
			{
				window.location.href = newlocation;
				res(300);
			}
			else
			{
				fetch(`/raw${newlocation.replace(/^\//g, "")}`).then((data) => {
					if (Math.floor(data.status / 100) == 2)
					{
						data.text().then((resp) => {
							document.body.innerHTML = resp.replace(/\{\{\s*([^}]+)\s*\}\}/g, (m, s) => {
								switch (s)
								{
									case "intra:user": return ("marvin");
									case "intra:campus": return ("42fr");
									default: return "";
								}
							});
							res(data.status);
						}).catch((reason) => {
							rej(reason);
						});
					}
					else
					{
						console.log(data.status);
						rej(data);
					}
				}).catch((err) => {
					console.log(err);
					rej(err);
				});
			}
		});
	}

	rollAuth()
	{
		return new Promise((res, rej) => {
			const auth = cookies.get("ft_intra_code");
			if (auth)
			{
				fetch("https://api.intra.42.fr/v2/me", {
					method: 'GET',
					headers: {
						"Authorization": `Bearer ${auth}`
					}
				}).then((resp) => {
					resp.json().then((data) => {
						res();
					}).catch((err) => {
						console.log(err);
						res();
					});
				}).catch((err) => {
					console.log(err);
					res();
				})
			}
			else
				rej();
		});
	}
}

const app = new cwapi();

app.rollAuth().then(() => {
	
}).catch((err) => {
	console.log(err);
	//window.location.href = "/panel/err?code=BAD_AUTH";
});