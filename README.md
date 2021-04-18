local file server

uses [rxfs](https://github.com/r1vn/rxfs)

## setup

- download [tsk-serve.tar.xz](https://github.com/r1vn/tsk-serve/raw/master/tsk-serve.tar.xz) and unpack as `your-project/lib/tsk-serve`
- add a config entry to the manifest

example config: serving `output` directory at `http://localhost:2345/blog`

```
{
    module: 'lib/tsk-serve',
    config:
    {
        // https://github.com/r1vn/rxfs#options
        root: 'output',
        port: 2345,
        baseurl: '/blog',
        autoindex: true,
        servedir: false
    }
}
```