class cookies
{
	static setCookie(cname, cvalue, exdays)
	{
		const d = new Date();
		d.setTime(d.getTime() + (exdays*24*60*60*1000));
		let expires = "expires="+ d.toUTCString();
		document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
	}

	static getCookie(cname)
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
		return "";
	}
}

class cwapi
{	
	constructor()
	{
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
				fetch(`/app/${newlocation.replace(/^\//g, "")}`).then((data) => {
					if (Math.floor(data.status / 100) == 2)
					{
						data.text().then((resp) => {
							document.body.innerHTML = resp;
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
}

const app = new cwapi();