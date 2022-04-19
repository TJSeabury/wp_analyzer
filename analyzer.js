import 'dotenv/config';
import fs from 'fs';
import fetch from "node-fetch";


const {
    domain,
    username,
    password
} = process.env;


function writeCSV () {
    let data = 'Old Filename, New Filename\n';
    for ( const p of paths ) {
        data += `${p}, [newFilename]\n`;
    }
    fs.writeFileSync( 'filenameMappings.csv', data );
}

async function API ( domain, userName, password, route = 'wp/v2/' ) {
    const url = "http://" + domain + "/wp-json/" + route;

    const token = Buffer.from( `${userName}:${password}` ).toString( 'base64' );

    const response = await fetch( url, {
        method: 'POST',
        body: JSON.stringify( {
            username: userName,
            password: password
        } ),
        headers: {
            'content-type': 'application/json',
            'authorization': "Basic " + token
        }
    } );
    return response.json();
}

const hitApi = async ( route, filter = d => d ) => await filter( await API(
    domain,
    username,
    password,
    route
) );

function routeWithParams ( route, params ) {
    let flatParams = '';
    params = Object.entries( params );
    let i = 0;
    for ( const [k, v] of params ) {
        flatParams += `${k}=${v}${i++ < params.length - 1 ? '&' : ''}`;
    }
    const endpoint = `${route}?${flatParams}`;
    return endpoint;
}

async function exhaustPagedContent ( route, params, filter = d => d ) {
    if ( !params || !params?.per_page ) {
        params = {
            per_page: 100
        };
    }
    params.offset = 0;
    let data = [];
    let temp = null;
    while ( ( temp = await hitApi( routeWithParams( route, params ), filter ) ).length === params.per_page ) {
        data = [...data, temp];
        params.offset = data.length * params.per_page;
    }
    data = [...data, temp];
    return data.reduce( ( accum, page ) => [...accum, ...page], [] );
}

async function inflateCategory ( id ) {
    const cat = await hitApi( `/wp/v2/categories/${id}` );
    return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
    };
}

async function inflateTag ( id ) {
    return await hitApi( `/wp/v2/tags/${id}` );
}

const metaOnlyFilter = async data => Promise.all( data.map( async datum => {
    const categories = datum.categories !== undefined
        ? await Promise.all( datum.categories?.map( id => inflateCategory( id ) ) )
        : null;
    const tags = await datum.tags?.map( id => inflateTag( id ) );
    return {
        id: datum.id,
        title: datum.title?.rendered,
        slug: datum.slug,
        status: datum.status,
        link: datum.link,
        published_date: datum.date,
        modified_date: datum.modified,
        categories: categories,
        tags: tags
    };
} ) );

const getRouteWriteData = async endpoint => {
    const pp = 100;
    const published = await exhaustPagedContent(
        `wp/v2/${endpoint}`,
        {
            status: 'publish',
            per_page: pp
        },
        metaOnlyFilter
    );
    const drafted = await exhaustPagedContent(
        `wp/v2/${endpoint}`,
        {
            status: 'draft',
            per_page: pp
        },
        metaOnlyFilter
    );
    fs.writeFileSync(
        `published_${endpoint}.json`,
        JSON.stringify( published, null, 2 )
    );
    fs.writeFileSync(
        `drafted_${endpoint}.json`,
        JSON.stringify( drafted, null, 2 )
    );
};

getRouteWriteData( 'pages' );
getRouteWriteData( 'posts' );